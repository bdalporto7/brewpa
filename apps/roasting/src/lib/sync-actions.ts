"use server";

import { runSync } from "@/lib/sync-client";

/**
 * On-demand sync once this install has sync turned on — a plain Server
 * Action, not an Electron IPC call, deliberately: this has to run inside
 * the same process as the local Prisma connection (apps/roasting/src/
 * lib/prisma.ts), since a second connection to the same local SQLite
 * file from Electron's main process is a confirmed hard failure (see
 * main.ts's own comments). Thin wrapper kept at this same name/shape so
 * SyncNowButton.tsx (and the periodic sync-trigger route) don't need to
 * know push/pull happen over HTTP now instead of a libsql .sync() call.
 */
export async function syncNow(): Promise<{ ok: boolean; error?: string }> {
  if (process.env.APP_MODE !== "desktop" || process.env.DESKTOP_SYNC_ENABLED !== "true") {
    return { ok: false, error: "Sync isn't turned on for this install." };
  }

  const result = await runSync();
  return { ok: result.ok, error: result.error };
}
