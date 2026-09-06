import { app, BrowserWindow, Menu, nativeImage, ipcMain, dialog, type Tray } from "electron";
import { spawn, type ChildProcess } from "node:child_process";
import * as path from "node:path";
import * as fs from "node:fs";
import * as http from "node:http";
import * as crypto from "node:crypto";
import * as dotenv from "dotenv";
import { runMigrations } from "./migrate";
import { startProbeBridge, type ProbeBridge } from "./probe";
import { createTray } from "./tray";
import { startStatusPoller } from "./desktop-status";
import { startSyncPoller } from "./sync-poller";
import { createSplashWindow } from "./splash";
import { DOCK_ICON_PNG_BASE64 } from "./icon-assets";

// Real credentials (GitHub/Google OAuth, Turso) live in a gitignored
// apps/desktop/.env, never committed and — critically — never bundled
// into a build meant to be handed to anyone else: this app is built to
// be given away for other people to run on their own, and shipping this
// developer's real production DB token/OAuth secrets in every copy would
// let every install that ever signed in read and write the *same* remote
// database, not to mention just leaking the credentials outright. Only
// `npm run dist:private`/`pack:private` (see package.json,
// scripts/after-pack.js) opt into bundling `.env`, for a build kept on
// this developer's own machine and never distributed; the normal
// `dist`/`pack` ship with none, and main.ts's own fallbacks below (empty
// OAuth id/secret, a placeholder AUTH_SECRET) make that a fully working
// local-only app rather than a crash — exactly the general-user case.
// Loaded from an explicit, packaging-aware path rather than bare
// `dotenv.config()`: that resolves relative to process.cwd(), which is
// apps/desktop for a `electron .` dev run but unpredictable for a real
// double-clicked/Dock-launched app — confirmed live that this silently
// found nothing in that case, leaving every sync-enabled real sign-in
// with empty Turso credentials and the whole startup sequence below
// throwing inside an unhandled rejection that never surfaced anywhere:
// the app just sat there forever with a splash window and no error.
dotenv.config({
  path: app.isPackaged ? path.join(process.resourcesPath, ".env") : path.resolve(__dirname, "..", ".env"),
});

// Standard Electron convention this app had no reason to skip: without
// it, launching the app a second time (double-clicking it again, or a
// second `open`) starts a completely separate process that would try to
// bind the same port and open the same local db file the first instance
// already has — confirmed live (see sync-poller.ts's own comment) that
// two processes touching the same local file at once is a real, hard
// failure, not just wasted resources. The second launch attempt quits
// immediately instead and just focuses the window the first instance
// already has.
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
}

// Affects app.getName() (used below in the app-menu label and About panel)
// — it does NOT change the bold app name macOS shows at the top of the
// screen next to the Apple logo. That text comes from the running
// executable's own Info.plist (CFBundleName), baked in at build time by
// electron-builder for a real packaged app; a dev run via `electron .` is
// always going to say "Electron" there, no matter what this call does.
// There's no dev-mode workaround for that specific piece of chrome — a
// real build (`npm run pack`, an unpacked Cybar Coffee.app) is the only
// way to actually see this.
app.setName("Cybar Coffee");

app.setAboutPanelOptions({
  applicationName: "Cybar Coffee",
  applicationVersion: app.getVersion(),
  copyright: "Cybar Coffee",
});

/**
 * One build for everyone — not two. A fresh install works fully offline,
 * local-only, no sign-in (general users never see a login screen). Sync
 * with the hosted DB is opt-in: a specific, allowlisted person can sign in
 * via the in-app "Sign in to sync" link (real GitHub/Google OAuth), and
 * once src/auth.ts's signIn callback confirms them against the *remote*
 * AllowedUser table, it writes syncEnabled: true to this file. That can't
 * take effect on the running server (hot-swapping its DB connection mid
 * request would race the redirect that same request is about to send), so
 * it takes effect on the next launch instead — this is read once here, at
 * startup, not watched live.
 */
const DESKTOP_CONFIG_PATH = path.join(app.getPath("userData"), "desktop-config.json");

function readDesktopConfig(): { syncEnabled: boolean; syncedEmail?: string; syncToken?: string } {
  try {
    const raw = fs.readFileSync(DESKTOP_CONFIG_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return {
      syncEnabled: parsed?.syncEnabled === true,
      syncedEmail: typeof parsed?.syncedEmail === "string" ? parsed.syncedEmail : undefined,
      syncToken: typeof parsed?.syncToken === "string" ? parsed.syncToken : undefined,
    };
  } catch {
    return { syncEnabled: false };
  }
}

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
 * Fixed, not random — real OAuth needs a static, pre-registered redirect
 * URI (http://localhost:41823/api/auth/callback/{github,google}); a random
 * port picked per launch would mean re-registering a new callback URL every
 * time the app starts. Real sign-in has to work from the very first launch
 * (that's how sync gets turned on at all — see src/auth.ts), so this is
 * fixed regardless of whether this particular install has sync turned on
 * yet.
 *
 * "localhost", not "127.0.0.1" — confirmed live that `next start` computes
 * its own internal request origin as `http://localhost:<port>` for a
 * loopback bind *regardless* of the actual incoming Host header (even a
 * request sent with a deliberately bogus Host header produced the same
 * origin), and that next-auth's own override for this (`AUTH_URL`, via its
 * `reqWithEnvURL` helper) doesn't work on this Next.js version either —
 * traced it down to `new NextRequest(newUrl, existingRequest)` silently
 * keeping the *existing* request's URL instead of adopting `newUrl`, a
 * genuine incompatibility between this next-auth version's assumption and
 * this Next.js version's actual behavior (reproduced directly, not
 * inferred). Rather than fight or patch around that, this just embraces
 * "localhost" as the one origin Next will actually produce here — it's
 * still loopback-only either way (macOS resolves it straight to
 * 127.0.0.1), so it doesn't reopen the Local Network permission-prompt
 * concern 127.0.0.1 was originally chosen to avoid.
 */
const PORT = 41823;
const HOST = "localhost";

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
let tray: Tray | null = null;
let statusPoller: ReturnType<typeof startStatusPoller> | null = null;
let syncPoller: ReturnType<typeof startSyncPoller> | null = null;

/** Used by the dock menu and the Go menu's keyboard shortcuts — both just want "show me this page," nothing fancier. */
function navigateTo(pagePath: string): void {
  if (!mainWindow) return;
  mainWindow.loadURL(`http://${HOST}:${PORT}${pagePath}`);
  mainWindow.show();
  mainWindow.focus();
}

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

function startNextServer(appBundleDir: string, dbPath: string, syncEnabled: boolean): ChildProcess {
  // The real script, not node_modules/.bin/next — that's an npm-created
  // symlink (`.bin/next -> ../next/dist/bin/next`), and confirmed live
  // that electron-builder's extraResources copy silently drops it
  // entirely rather than preserving or resolving it, so a real packaged
  // build threw ENOENT trying to spawn it (this was never caught before
  // today because every test up to now ran via `electron .`, which reads
  // app-bundle straight off disk with no copy step involved). Spawning
  // this script directly sidesteps that regardless of how any future
  // packaging step handles symlinks.
  const nextScript = path.join(appBundleDir, "node_modules", "next", "dist", "bin", "next");

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: "production",
    APP_MODE: "desktop",
    DESKTOP_SYNC_ENABLED: syncEnabled ? "true" : "false",
    DESKTOP_CONFIG_PATH,
    DATABASE_URL: `file:${dbPath}`,
    NEXT_TELEMETRY_DISABLED: "1",
    PROBE_INGEST_TOKEN: PROBE_TOKEN,
  };

  // Ideally present on every launch (real values, loaded from
  // apps/desktop/.env above — the same hosted Turso database and the same
  // OAuth apps the web deployment uses, with a second, local callback URL
  // added to each — see the plan) so real sign-in works even before sync
  // is turned on. But a genuine general-user install may have no .env at
  // all — that has to still produce a working local-only app, not a
  // crash, so these fall back to empty placeholders (next-auth/providers
  // reads them at import time regardless of whether they're ever used;
  // an empty client id just makes "Sign in to sync" fail harmlessly if
  // clicked, same as the old standalone build's placeholders).
  //
  // TURSO_DATABASE_URL/TURSO_AUTH_TOKEN specifically only matter for the
  // one-time bootstrap moment auth.ts's signIn callback handles (checking
  // the remote allowlist and minting this install's SyncToken *before*
  // syncEnabled flips on) — once already synced, ongoing sync goes
  // through SYNC_API_BASE_URL + the token already sitting in
  // desktop-config.json instead, so there's nothing left here to
  // hard-require once syncEnabled is true.
  for (const key of [
    "TURSO_DATABASE_URL",
    "TURSO_AUTH_TOKEN",
    "AUTH_GITHUB_ID",
    "AUTH_GITHUB_SECRET",
    "AUTH_GOOGLE_ID",
    "AUTH_GOOGLE_SECRET",
    "SYNC_API_BASE_URL",
  ]) {
    env[key] = process.env[key] ?? "";
  }
  env.AUTH_SECRET = process.env.AUTH_SECRET ?? "insecure-placeholder-set-a-real-one-in-.env-to-enable-sign-in";

  // Run through Electron's own bundled Node runtime (ELECTRON_RUN_AS_NODE),
  // not whatever `node` a shebang line might find on the end user's PATH —
  // this app ships its own complete node_modules specifically so it never
  // depends on anything being separately installed, and most non-developer
  // machines have no system Node.js at all.
  const child = spawn(process.execPath, [nextScript, "start", "-p", String(PORT), "-H", HOST], {
    cwd: appBundleDir,
    env: { ...env, ELECTRON_RUN_AS_NODE: "1" },
    stdio: "pipe",
  });

  child.stdout?.on("data", (d) => console.log(`[next] ${d.toString().trimEnd()}`));
  child.stderr?.on("data", (d) => console.error(`[next] ${d.toString().trimEnd()}`));
  child.on("exit", (code) => console.log(`[next] server exited with code ${code}`));

  return child;
}

/**
 * `hiddenInset` (macOS only) trades the plain gray OS title bar for just
 * the inset traffic lights, floating directly over this app's own dark
 * nav header (src/components/Nav.tsx, #2b1d14) — the same chrome pattern
 * apps like Slack/Notion use so the window reads as a real native app
 * instead of "a browser pointed at a URL," which is exactly what a plain
 * BrowserWindow otherwise looks like. `backgroundColor` matches that same
 * nav color so the window doesn't flash white while the page loads.
 * NavClient.tsx adds matching left padding (gated on APP_MODE=desktop) so
 * the traffic lights don't sit on top of the Cybar wordmark.
 */
async function createMainWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 840,
    title: "Cybar Coffee",
    backgroundColor: "#2b1d14",
    ...(process.platform === "darwin" ? { titleBarStyle: "hiddenInset" as const } : {}),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });
  await mainWindow.loadURL(`http://${HOST}:${PORT}`);
}

/**
 * Electron's own default menu literally says "Electron" as the app menu's
 * name and includes items (like the default About panel) that don't fit
 * this app — replaced with a minimal, Mac-standard set instead. This
 * isn't just cosmetic: without a real Edit menu, there's no menu-driven
 * Cmd+C/Cmd+V/Cmd+A at all in a packaged Electron app (Chromium only wires
 * those shortcuts to a menu role, not globally), so text inputs across
 * the app would silently not support copy/paste without this.
 */
function buildAppMenu(): void {
  const isMac = process.platform === "darwin";
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" as const },
              { type: "separator" as const },
              { role: "services" as const },
              { type: "separator" as const },
              { role: "hide" as const },
              { role: "hideOthers" as const },
              { role: "unhide" as const },
              { type: "separator" as const },
              { role: "quit" as const },
            ],
          },
        ]
      : []),
    {
      label: "Edit",
      submenu: [
        { role: "undo" as const },
        { role: "redo" as const },
        { type: "separator" as const },
        { role: "cut" as const },
        { role: "copy" as const },
        { role: "paste" as const },
        { role: "selectAll" as const },
      ],
    },
    {
      label: "View",
      submenu: [{ role: "reload" as const }, { role: "toggleDevTools" as const }],
    },
    // Cmd+1-5 to jump straight to a section, the way a real menu-bar-driven
    // Mac app behaves and a browser tab never does — no keyboard shortcut
    // for a page you'd otherwise have to click a nav link for every time.
    {
      label: "Go",
      submenu: [
        { label: "Dashboard", accelerator: "CmdOrCtrl+1", click: () => navigateTo("/") },
        { label: "Beans", accelerator: "CmdOrCtrl+2", click: () => navigateTo("/beans") },
        { label: "Roasts", accelerator: "CmdOrCtrl+3", click: () => navigateTo("/roasts") },
        { label: "Profiles", accelerator: "CmdOrCtrl+4", click: () => navigateTo("/profiles") },
        { label: "Drops", accelerator: "CmdOrCtrl+5", click: () => navigateTo("/friends") },
      ],
    },
    {
      label: "Window",
      submenu: [
        { role: "close" as const },
        { role: "minimize" as const },
        { role: "zoom" as const },
        ...(isMac ? [{ role: "front" as const }] : []),
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// Standard macOS convention this app was missing entirely: closing the
// window (the red button, not Cmd+Q) leaves the process running with no
// window at all — confirmed live that this makes the app look completely
// broken, since clicking the dock icon to "reopen" it just sends
// 'activate' to that same still-running, windowless process, and with no
// handler for it, nothing visibly happens. The app isn't hung — it's
// alive with no way back to a visible window without this.
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  } else {
    mainWindow?.show();
    mainWindow?.focus();
  }
});

// The renderer's "Restart to finish syncing" control (SyncNowButton.tsx's
// sibling in apps/roasting) calls this via preload.ts's contextBridge —
// a real one-click relaunch instead of asking the user to figure out
// themselves that closing the window isn't enough and they need Cmd+Q.
// app.relaunch() queues a fresh launch; app.exit() (not app.quit(), which
// can be intercepted or delayed by other handlers) ends this process
// immediately so the new one starts clean.
ipcMain.handle("restart-app", () => {
  app.relaunch();
  app.exit(0);
});

// A synchronous confirm, not the async dialog.showMessageBox + preventDefault
// dance — before-quit can just block on the answer here. Doesn't interfere
// with the restart-to-sync flow's app.exit() call (ipcMain.handle above):
// exit() skips before-quit entirely, by design, which is exactly why that
// flow uses it instead of quit() — a restart the user just asked for
// shouldn't re-ask them to confirm it.
app.on("before-quit", (event) => {
  if (statusPoller?.isActive()) {
    const choice = dialog.showMessageBoxSync({
      type: "warning",
      buttons: ["Quit Anyway", "Cancel"],
      defaultId: 1,
      cancelId: 1,
      title: "A roast is in progress",
      message: "Quitting now will stop tracking this roast.",
      detail: "The roaster itself keeps running — this only stops Cybar Coffee from logging anything else for this roast until you reopen it.",
    });
    if (choice === 1) {
      event.preventDefault();
      return;
    }
  }
  probeBridge?.stop();
  serverProcess?.kill();
  statusPoller?.stop();
  syncPoller?.stop();
});

app.whenReady().then(async () => {
  buildAppMenu();

  // electron-builder reads build-resources/icon.icns for a real packaged
  // build automatically — this is only for `electron .` dev runs, which
  // skip that step entirely and would otherwise show the generic Electron
  // icon in the dock while testing.
  if (process.platform === "darwin" && !app.isPackaged) {
    // A plain PNG, not icon.icns — confirmed live that nativeImage silently
    // fails to decode this project's .icns (iconutil compresses some of an
    // icns's internal representations as HEIF/"ic12", which Chromium's
    // image decoder doesn't support; createFromPath() returns an empty
    // image with no error). The dock API only ever needs one high-res
    // bitmap anyway — electron-builder is what actually needs the full
    // multi-resolution .icns, for the real packaged build.
    app.dock?.setIcon(nativeImage.createFromDataURL(`data:image/png;base64,${DOCK_ICON_PNG_BASE64}`));
  }

  // Everything between here and createMainWindow() at the end of this
  // block — spawning Next, migrating/syncing on a first-post-sign-in
  // launch, waiting for the server — is genuinely slow (real seconds, not
  // milliseconds), and until this there was nothing on screen for any of
  // it: just a blank gap, or on a slow launch, no window at all yet. A
  // small splash window closes that gap; it's torn down the moment the
  // real window's loadURL below actually resolves.
  const splashWindow = createSplashWindow();

  // Everything in this block used to be able to throw or reject with
  // nothing catching it — an unhandled rejection inside this async
  // callback, which Electron doesn't crash the process for by default.
  // The visible symptom was the app just sitting there forever: splash
  // window up, no error, no window, no way to tell what was wrong short
  // of relaunching from a terminal to see stdout. Wrapping the whole
  // sequence means any failure here — a bad .env, the server never
  // coming up — now shows a real dialog and quits instead of hanging
  // invisibly.
  try {
    const appBundleDir = resolveAppBundleDir();
    const dbPath = resolveUserDataDbPath();
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });

    const desktopConfig = readDesktopConfig();
    const syncEnabled = desktopConfig.syncEnabled;

    // The local file is always plain SQLite now, sync-enabled or not —
    // "sync" is an application-level operation (src/lib/sync-client.ts,
    // over the hosted app's /api/sync/pull|push, triggered by
    // sync-poller.ts below) running inside the Next server process, not
    // a different *kind* of local database the way a libsql embedded
    // replica was. Migrations run before the server starts, directly
    // against the file — not through the Next server, and not through
    // the Prisma CLI (no schema-engine binary needed).
    await runMigrations(dbPath, appBundleDir);

    serverProcess = startNextServer(appBundleDir, dbPath, syncEnabled);
    await waitForServer(`http://${HOST}:${PORT}`, 30_000);

    // Auto-starts and quietly retries if the meter isn't plugged in — no
    // separate manual script/step anymore. Started after the server is
    // confirmed up so its very first readings have somewhere to land
    // instead of failing against a not-yet-ready port.
    probeBridge = startProbeBridge({
      path: PROBE_SERIAL_PATH,
      apiBase: `http://${HOST}:${PORT}`,
      token: PROBE_TOKEN,
    });

    const apiBase = `http://${HOST}:${PORT}`;
    statusPoller = startStatusPoller(apiBase);
    // Pushes local changes up and pulls this team's current data down on
    // an interval, entirely by asking the already-running server to do
    // it (see sync-poller.ts's own comment) — only started once this
    // install has actually signed in and turned sync on.
    if (syncEnabled) {
      syncPoller = startSyncPoller(apiBase);
    }
    tray = createTray(() => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      } else {
        createMainWindow();
      }
    });

    // Right-click quick actions on the dock icon — the same "jump straight
    // to a page" convenience as the Go menu's Cmd+1-5, surfaced somewhere a
    // browser tab has no equivalent of at all (a website can't add items to
    // its own dock-icon right-click menu).
    if (process.platform === "darwin") {
      app.dock?.setMenu(
        Menu.buildFromTemplate([
          { label: "Start a Roast", click: () => navigateTo("/roasts") },
          { label: "View Beans", click: () => navigateTo("/beans") },
          { label: "View Roasts", click: () => navigateTo("/roasts") },
        ]),
      );
    }

    await createMainWindow();
    splashWindow.destroy();
  } catch (err) {
    console.error("Cybar Coffee failed to start:", err);
    splashWindow.destroy();
    dialog.showErrorBox("Cybar Coffee couldn't start", err instanceof Error ? err.message : String(err));
    serverProcess?.kill();
    app.quit();
  }
});
