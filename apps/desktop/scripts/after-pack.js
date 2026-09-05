#!/usr/bin/env node
/**
 * electron-builder unconditionally excludes any directory literally named
 * "node_modules" from file copying — confirmed live that this holds even
 * for an `extraResources` entry with an explicit `filter: ["**\/*"]`
 * override, which per the docs should replace electron-builder's own
 * default filter entirely but didn't change this specific behavior. The
 * documented workaround for this exact, long-standing issue (see
 * electron-userland/electron-builder#3104/#3185) is an afterPack hook that
 * copies the directory in manually, after electron-builder's own file
 * matching has already run and can no longer object to it.
 *
 * Only meaningful for macOS right now — this project doesn't build for
 * Windows/Linux yet, so the app path shape below isn't handled for those.
 */
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

// `cp -RL`, not fs.cpSync — both directories below are full of symlinks
// (npm's node_modules/.bin/* entries, and Next's own .next/node_modules
// build-trace farm — see prepare-app.js's comment on why that one has to
// survive into the packaged app at all) created as *absolute* paths back
// into this project's own app-bundle/ checkout, not relative ones scoped
// to their own directory. Copying them as-is put live symlinks in the
// shipped app pointing outside the bundle entirely, which is exactly what
// made codesign refuse to sign it ("invalid destination for symbolic link
// in bundle"). fs.cpSync's own `dereference: true` option is documented
// to fix exactly this and is the obvious first thing to reach for —
// confirmed live, with a trivial reproduction outside this project too,
// that it silently doesn't dereference recursively despite the option;
// `cp -RL`'s `-L` (always follow symlinks) does, verified against that
// same reproduction, so this shells out rather than trusting fs.cpSync.
function copyDereferenced(src, dest) {
  console.log(`[after-pack] copying ${src} -> ${dest}`);
  execFileSync("cp", ["-RL", src, dest]);
}

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") return;

  const appName = context.packager.appInfo.productFilename;
  const resourcesDir = path.join(context.appOutDir, `${appName}.app`, "Contents", "Resources");
  const bundleSrc = path.resolve(__dirname, "..", "app-bundle");
  const bundleDest = path.join(resourcesDir, "app-bundle");

  copyDereferenced(path.join(bundleSrc, "node_modules"), path.join(bundleDest, "node_modules"));
  copyDereferenced(path.join(bundleSrc, ".next", "node_modules"), path.join(bundleDest, ".next", "node_modules"));

  // apps/desktop/.env holds the real OAuth/Turso secrets for this specific
  // developer's own builds — deliberately never in `files`/`extraResources`
  // (which would need it to exist for anyone building this app at all,
  // and `files` globs are resolved before this hook runs, so a plain glob
  // can't express "copy it if present, skip it otherwise" the way this
  // plain fs check can). Without this, `dotenv.config()` in main.ts finds
  // nothing at runtime — it looks relative to process.cwd(), which for a
  // real packaged/double-clicked app is unpredictable and never
  // apps/desktop itself the way a `electron .` dev run's cwd is. That
  // silently left every sync-enabled real sign-in with empty
  // TURSO_DATABASE_URL/TURSO_AUTH_TOKEN, throwing inside an unhandled
  // promise rejection that never surfaced anywhere — confirmed live as the
  // exact cause of the app hanging forever on startup with no window and
  // no error. A general contributor building without their own .env still
  // gets a working (local-only, no sign-in) app — this just skips silently.
  const envSrc = path.resolve(__dirname, "..", ".env");
  if (fs.existsSync(envSrc)) {
    console.log(`[after-pack] copying ${envSrc} -> ${path.join(resourcesDir, ".env")}`);
    fs.copyFileSync(envSrc, path.join(resourcesDir, ".env"));
  } else {
    console.log("[after-pack] no apps/desktop/.env found — shipping without one (local-only mode still works)");
  }
};
