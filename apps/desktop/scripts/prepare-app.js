#!/usr/bin/env node
/**
 * Builds a clean, isolated copy of ../roasting into ./app-bundle for
 * electron-builder to package as an extraResource. Deliberately never
 * touches the real apps/roasting checkout in place — `npm ci --omit=dev`
 * there would strip devDependencies (eslint, typescript, tailwind...) the
 * user actually needs for day-to-day development on that project. Copy
 * first, install/build in the copy, leave the original untouched.
 *
 * No `output: "standalone"` here (see the plan) — this ships the full
 * production node_modules deliberately, to sidestep Next's file-tracing
 * missing native addon files.
 */
const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

const ROASTING_DIR = path.resolve(__dirname, "..", "..", "roasting");
const BUNDLE_DIR = path.resolve(__dirname, "..", "app-bundle");

const EXCLUDE = new Set(["node_modules", ".next", ".git", ".env", ".env.local", "dev.db"]);

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (EXCLUDE.has(path.basename(src))) return;
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

console.log(`[prepare-app] cleaning ${BUNDLE_DIR}`);
fs.rmSync(BUNDLE_DIR, { recursive: true, force: true });
fs.mkdirSync(BUNDLE_DIR, { recursive: true });

console.log(`[prepare-app] copying ${ROASTING_DIR} -> ${BUNDLE_DIR}`);
for (const entry of fs.readdirSync(ROASTING_DIR)) {
  if (EXCLUDE.has(entry)) continue;
  copyRecursive(path.join(ROASTING_DIR, entry), path.join(BUNDLE_DIR, entry));
}

// Deliberately a full `npm ci`, not `--omit=dev`: found by actually running
// this (not assumed) that @tailwindcss/postcss — a devDependency — is
// needed *during* `next build` for CSS processing, not just in `next dev`.
// Pruning dev deps before building broke the build outright. Keeping them
// through to the shipped bundle costs some disk space, which doesn't
// matter for a desktop installer the way it would for a serverless bundle.
console.log("[prepare-app] npm ci (in the copy only)");
execSync("npm ci", { cwd: BUNDLE_DIR, stdio: "inherit" });

// prisma generate runs as a postinstall in apps/roasting's own package.json
// — `npm ci` above already triggers it, generating the client against
// whatever's in prisma/schema.prisma. `next build` needs a DATABASE_URL to
// exist at build time (even though runtime uses the real userData path) —
// any valid sqlite URL satisfies Prisma's schema validation here.
console.log("[prepare-app] next build");
execSync("npm run build", {
  cwd: BUNDLE_DIR,
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: "file:./build-placeholder.db" },
});
fs.rmSync(path.join(BUNDLE_DIR, "build-placeholder.db"), { force: true });

console.log("[prepare-app] done");
