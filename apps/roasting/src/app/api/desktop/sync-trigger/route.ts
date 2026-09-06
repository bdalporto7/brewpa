import { NextResponse } from "next/server";
import { runSync } from "@/lib/sync-client";

/**
 * Polled by Electron's main process (apps/desktop/src-ts/sync-poller.ts),
 * never by a browser — same reasoning as api/desktop/status: no session,
 * excluded from proxy.ts's gate, 404s outside the desktop app. This is
 * the *only* thing main.ts does for background sync — it never opens its
 * own connection to the local database (a second process touching that
 * file is a confirmed hard failure, see main.ts's own comments); it just
 * asks this already-running server process to run the sync it already
 * knows how to do (src/lib/sync-client.ts), the same as SyncNowButton's
 * on-demand trigger does.
 */
export async function POST() {
  if (process.env.APP_MODE !== "desktop") {
    return NextResponse.json({ error: "Desktop-only endpoint" }, { status: 404 });
  }
  if (process.env.DESKTOP_SYNC_ENABLED !== "true") {
    return NextResponse.json({ ok: false, error: "Sync isn't turned on for this install." });
  }

  const result = await runSync();
  return NextResponse.json(result);
}
