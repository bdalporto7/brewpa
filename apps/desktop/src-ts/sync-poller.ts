/**
 * Triggers background sync on an interval by POSTing the already-running
 * local server's own /api/desktop/sync-trigger route — mirrors desktop-
 * status.ts's poll-the-local-server shape exactly, and for the same
 * reason: this process never opens its own connection to the local
 * database (a second connection from Electron's main process while the
 * server's own Prisma connection has the same file open is a confirmed
 * hard failure), it just asks the server to do work it already knows how
 * to do. Failures are swallowed quietly here on purpose — a revoked
 * token or a network blip shouldn't pop an error dialog every interval;
 * only the user-initiated "Sync now" button surfaces an error directly.
 */
export function startSyncPoller(apiBase: string, intervalMs = 60_000): { stop: () => void } {
  let stopped = false;

  async function tick() {
    if (stopped) return;
    try {
      await fetch(`${apiBase}/api/desktop/sync-trigger`, { method: "POST" });
    } catch {
      // Server not up yet, offline, or a transient blip — just try again next tick.
    }
  }

  const timer = setInterval(tick, intervalMs);
  tick();

  return {
    stop: () => {
      stopped = true;
      clearInterval(timer);
    },
  };
}
