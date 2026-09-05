import { contextBridge, ipcRenderer } from "electron";

/**
 * Narrow, single-purpose bridge — not a general IPC channel. The one thing
 * the renderer (the same Next.js UI the hosted web app serves) needs to
 * reach into the main process for is restarting the app after sign-in
 * turns sync on (src/components/RestartToSyncButton.tsx in apps/roasting),
 * since that's a real process relaunch (app.relaunch() + app.exit()) that
 * only the main process can do. Everything else — reading data, writing
 * data, syncing — already goes through ordinary Server Actions against the
 * Next server, same as the hosted app; this exists only for the one action
 * that isn't a database operation at all.
 */
contextBridge.exposeInMainWorld("cybarDesktop", {
  restartApp: () => ipcRenderer.invoke("restart-app"),
});
