import { contextBridge, ipcRenderer } from "electron";

/**
 * Narrow, single-purpose bridge — not a general IPC channel. Everything
 * that's a database operation (reading data, writing data, syncing)
 * already goes through ordinary Server Actions against the Next server,
 * same as the hosted app; this exists only for the handful of actions
 * that genuinely need the main process: a real process relaunch
 * (app.relaunch() + app.exit()), opening the system browser for real
 * sign-in, and clearing the local sync config.
 */
contextBridge.exposeInMainWorld("cybarDesktop", {
  restartApp: () => ipcRenderer.invoke("restart-app"),
  startSyncPairing: () => ipcRenderer.invoke("start-sync-pairing"),
  disableSync: () => ipcRenderer.invoke("disable-sync"),
});
