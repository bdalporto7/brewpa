"use server";

import { createClient } from "@libsql/client";

/**
 * On-demand sync once this install has sync turned on — a plain Server Action, not
 * an Electron IPC call, deliberately: this has to run inside the same
 * process as Prisma's own libsql connection (apps/roasting/src/lib/prisma.ts),
 * since a libsql embedded replica can't have two different *processes*
 * holding the same local file open at once (confirmed live — a separate
 * client in Electron's main process caused "Can not sync a database
 * without a wal_index" the moment this server's own Prisma connection
 * tried to open the same file). A fresh client here, in this same process,
 * pointed at the same file/syncUrl as Prisma's own connection, is the
 * supported pattern instead — see apps/desktop/src-ts/main.ts's comment
 * for the fuller story of what didn't work first.
 */
export async function syncNow(): Promise<{ ok: boolean; framesSynced?: number; error?: string }> {
  if (process.env.APP_MODE !== "desktop" || process.env.DESKTOP_SYNC_ENABLED !== "true") {
    return { ok: false, error: "Sync isn't turned on for this install." };
  }

  const url = process.env.DATABASE_URL;
  const syncUrl = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !syncUrl || !authToken) {
    return { ok: false, error: "Missing DATABASE_URL/TURSO_DATABASE_URL/TURSO_AUTH_TOKEN." };
  }

  const client = createClient({ url, syncUrl, authToken });
  try {
    const result = await client.sync?.();
    if (!result) {
      return { ok: false, error: "This connection wasn't opened with a syncUrl." };
    }
    return { ok: true, framesSynced: result.frames_synced };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    client.close();
  }
}
