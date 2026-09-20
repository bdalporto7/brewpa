import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAllowedUser } from "@/lib/admin";

/**
 * Polled by LiveProbePanel while a roast is pending or live — proxy.ts
 * already gates this path behind a signed-in session, but Server
 * Functions/route handlers are directly callable, so this re-checks
 * rather than trusting the proxy alone (same reasoning as
 * requireAdmin() in src/lib/admin-actions.ts). Checks the *team* actually
 * owns this roast, not just that some session exists — TemperatureReading
 * itself carries no teamId (scoped transitively via RoastSession).
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentAllowedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const session = await prisma.roastSession.findFirst({ where: { id, teamId: user.teamId } });
  if (!session) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // `?after=<epoch ms>` returns only rows recorded after that instant, so
  // the live chart's ~1s poll (see useProbeReadings) pulls a handful of new
  // rows instead of re-reading the whole series every time. Omitted =
  // everything, as before. The caller subtracts a small overlap and dedupes
  // by id, so a row landing in the same millisecond as the cursor can't be
  // skipped.
  const afterParam = Number(new URL(request.url).searchParams.get("after"));
  const after = Number.isFinite(afterParam) && afterParam > 0 ? new Date(afterParam) : null;

  const readings = await prisma.temperatureReading.findMany({
    where: { roastSessionId: id, ...(after ? { recordedAt: { gt: after } } : {}) },
    orderBy: { recordedAt: "asc" },
  });

  return NextResponse.json({ readings });
}
