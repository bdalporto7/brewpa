import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveSyncRequest } from "@/lib/sync-tokens";

/**
 * TemperatureReading is deliberately excluded from the generic snapshot
 * pull (see api/sync/pull's own comment) — no updatedAt, and it arrives
 * every few seconds during a live roast, so pulling it on every periodic
 * background sync would be wasteful for every roast that isn't the one
 * currently open. Fetched on demand instead, mirroring the same shape
 * the already-existing session-viewer endpoint uses
 * (api/roasts/[id]/temperature/route.ts) — just bearer-authed instead of
 * session-cookie-authed, and with a `since` cursor since a synced client
 * already has everything up to its last fetch.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await resolveSyncRequest(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const session = await prisma.roastSession.findFirst({ where: { id, teamId: token.user.teamId } });
  if (!session) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const since = request.nextUrl.searchParams.get("since");
  const readings = await prisma.temperatureReading.findMany({
    where: { roastSessionId: id, ...(since ? { recordedAt: { gt: new Date(since) } } : {}) },
    orderBy: { recordedAt: "asc" },
  });

  return NextResponse.json({ readings });
}
