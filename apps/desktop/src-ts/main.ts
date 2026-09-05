import { app, BrowserWindow } from "electron";
import { spawn, type ChildProcess } from "node:child_process";
import * as path from "node:path";
import * as fs from "node:fs";
import * as http from "node:http";
import * as crypto from "node:crypto";
import { runMigrations } from "./migrate";
import { startProbeBridge, type ProbeBridge } from "./probe";

/**
 * Generated fresh per launch, not persisted — this only ever needs to
 * match between two things running in the same process tree (the spawned
 * Next server checking it, and the probe bridge sending it), both started
 * by this same file a few lines apart. No separate secret-management step
 * needed the way the old standalone script's PROBE_INGEST_TOKEN did.
 */
const PROBE_TOKEN = crypto.randomUUID();
const PROBE_SERIAL_PATH = process.env.PROBE_SERIAL_PORT ?? "/dev/cu.usbserial-0001";

/**
 * Fixed, not random — a real OAuth app (Phase 2's personal-synced build)
 * needs a static, pre-registered redirect URI
 * (http://localhost:41823/api/auth/callback/{github,google}); a random
 * port picked per launch would mean re-registering a new callback URL
 * every time the app starts. Phase 1 (this build) has no OAuth at all
 * (APP_MODE=standalone bypasses auth entirely — see src/auth.ts in
 * apps/roasting), but keeping the same fixed port from day one means
 * Phase 2 doesn't have to revisit this.
 */
const PORT = 41823;
const HOST = "127.0.0.1"; // loopback only — avoids macOS firewall/Local Network prompts entirely, see the plan's Q5 research

/**
 * Both dev and packaged runs point at the same built artifact:
 * scripts/prepare-app.js's isolated copy at apps/desktop/app-bundle,
 * never the raw apps/roasting checkout directly — that checkout has no
 * reason to have its own `.next` production build sitting around (this
 * app's actual dev workflow is `next dev`, not `next start`), so pointing
 * dev mode at it directly fails with "Could not find a production build"
 * the moment it hasn't been built in place — found by actually launching
 * this, not by inspection. Packaged builds read from
 * `process.resourcesPath` (electron-builder's `extraResources`); dev runs
 * (`electron .`) read the same `app-bundle/` directly since there's no
 * resourcesPath yet outside a real package.
 */
function resolveAppBundleDir(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "app-bundle");
  }
  return path.resolve(__dirname, "..", "app-bundle");
}

function resolveUserDataDbPath(): string {
  return path.join(app.getPath("userData"), "app.db");
}

let serverProcess: ChildProcess | null = null;
let mainWindow: BrowserWindow | null = null;
let probeBridge: ProbeBridge | null = null;

function waitForServer(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    function attempt() {
      const req = http.get(url, (res) => {
        res.destroy();
        resolve();
      });
      req.on("error", () => {
        if (Date.now() > deadline) {
          reject(new Error(`Server didn't respond at ${url} within ${timeoutMs}ms`));
          return;
        }
        setTimeout(attempt, 300);
      });
    }
    attempt();
  });
}

function startNextServer(appBundleDir: string, dbPath: string): ChildProcess {
  const nextBin = path.join(appBundleDir, "node_modules", ".bin", "next");
  const child = spawn(nextBin, ["start", "-p", String(PORT), "-H", HOST], {
    cwd: appBundleDir,
    env: {
      ...process.env,
      NODE_ENV: "production",
      APP_MODE: "standalone",
      DATABASE_URL: `file:${dbPath}`,
      NEXT_TELEMETRY_DISABLED: "1",
      // Standalone mode has no OAuth app registered anywhere — these are
      // read by next-auth/providers/{github,google} at import time
      // regardless of whether they're ever used; empty strings avoid a
      // module-load-time crash on missing env vars without pretending
      // there's a real provider configured.
      AUTH_GITHUB_ID: process.env.AUTH_GITHUB_ID ?? "",
      AUTH_GITHUB_SECRET: process.env.AUTH_GITHUB_SECRET ?? "",
      AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID ?? "",
      AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET ?? "",
      AUTH_SECRET: process.env.AUTH_SECRET ?? "standalone-build-does-not-use-real-sessions",
      PROBE_INGEST_TOKEN: PROBE_TOKEN,
    },
    stdio: "pipe",
  });

  child.stdout?.on("data", (d) => console.log(`[next] ${d.toString().trimEnd()}`));
  child.stderr?.on("data", (d) => console.error(`[next] ${d.toString().trimEnd()}`));
  child.on("exit", (code) => console.log(`[next] server exited with code ${code}`));

  return child;
}

async function createMainWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 840,
    title: "Cybar Coffee",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  await mainWindow.loadURL(`http://${HOST}:${PORT}`);
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  probeBridge?.stop();
  serverProcess?.kill();
});

app.whenReady().then(async () => {
  const appBundleDir = resolveAppBundleDir();
  const dbPath = resolveUserDataDbPath();
  // Just ensures the containing directory exists — runMigrations (below)
  // does the real "is this DB empty" check, against migration history
  // rather than file existence, since an empty-but-present file should
  // still be treated as fresh.
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  // Migrations run before the server starts, directly against the libsql
  // file — not through the Next server, and not through the Prisma CLI
  // (see the plan's decision 5 for why: no schema-engine binary needed).
  await runMigrations(dbPath, appBundleDir);

  serverProcess = startNextServer(appBundleDir, dbPath);

  try {
    await waitForServer(`http://${HOST}:${PORT}`, 30_000);
  } catch (err) {
    console.error("Next server never came up:", err);
    app.quit();
    return;
  }

  // Auto-starts and quietly retries if the meter isn't plugged in — no
  // separate manual script/step anymore. Started after the server is
  // confirmed up so its very first readings have somewhere to land
  // instead of failing against a not-yet-ready port.
  probeBridge = startProbeBridge({
    path: PROBE_SERIAL_PATH,
    apiBase: `http://${HOST}:${PORT}`,
    token: PROBE_TOKEN,
  });

  await createMainWindow();
});
