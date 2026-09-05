import { BrowserWindow } from "electron";
import { SPLASH_ICON_PNG_BASE64 } from "./icon-assets";

/**
 * Shown the instant the app launches, well before the spawned Next server
 * (and, on a synced install's very first post-sign-in launch, the
 * migrate-to-remote + wipe + resync sequence in main.ts) is anywhere near
 * ready — that whole sequence can take a few real seconds, and until now
 * the user just saw nothing (a blank/flashing space, or literally no
 * window at all) for that entire window. A small branded window closes
 * the "is this even doing anything" gap a plain BrowserWindow left open.
 *
 * The mascot image is inlined as a data URL (see icon-assets.ts) rather
 * than loaded from a file — this window's whole HTML is a single template
 * string with no separate assets to resolve a path for, packaged or not.
 */
export function createSplashWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 320,
    height: 320,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    show: true,
    backgroundColor: "#2b1d14",
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: { contextIsolation: true },
  });

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  html, body {
    margin: 0;
    height: 100%;
    background: #2b1d14;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    -webkit-app-region: drag;
    user-select: none;
  }
  img {
    width: 128px;
    height: 128px;
    animation: bob 1.6s ease-in-out infinite;
  }
  p {
    margin-top: 16px;
    color: #cbb59a;
    font-size: 13px;
    letter-spacing: 0.02em;
  }
  @keyframes bob {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-8px); }
  }
</style>
</head>
<body>
  <img src="data:image/png;base64,${SPLASH_ICON_PNG_BASE64}" alt="">
  <p>Starting Cybar Coffee…</p>
</body>
</html>`;

  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  return win;
}
