import { Tray, Menu, nativeImage } from "electron";
import { TRAY_ICON_PNG_BASE64 } from "./icon-assets";

let tray: Tray | null = null;

/**
 * A full-color tray icon, not a template (monochrome) one — Electron's
 * template-image mode expects a black-on-transparent glyph it then tints
 * to match the menu bar; the mascot is a colored brown robot, so forcing
 * template mode would flatten it into an unrecognizable black silhouette.
 * Plenty of real menu bar apps (Spotify, Discord) use full-color tray
 * icons for exactly this reason — legibility/identity over blending in.
 */
export function createTray(onOpen: () => void): Tray {
  const icon = nativeImage.createFromDataURL(`data:image/png;base64,${TRAY_ICON_PNG_BASE64}`).resize({ width: 18, height: 18 });
  tray = new Tray(icon);
  tray.setToolTip("Cybar Coffee");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Open Cybar Coffee", click: onOpen },
      { type: "separator" },
      { role: "quit" },
    ]),
  );
  // Clicking the icon itself (not just the menu) opens the window too —
  // the menu is there for Quit, not because opening should require it.
  tray.on("click", onOpen);
  return tray;
}

/** The live "187°F · 6:42" text next to the icon — cleared (empty string) when no roast is active. */
export function setTrayStatusText(text: string): void {
  tray?.setTitle(text);
}
