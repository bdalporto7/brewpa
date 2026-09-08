import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveProbeRequest } from "@/lib/probe-tokens";

/**
 * Always logs against whichever RoastSession is currently active
 * (endedAt: null) for the calling ProbeToken's own team, rather than
 * requiring the caller to know a session id — a team only ever has one
 * roast in flight at a time, so "the active one" is unambiguous within
 * that team, and it's what lets the probe script stay completely dumb:
 * point it at this endpoint once, it never needs to know the roast has
 * changed. Scoped by teamId (not just "most recent across every team")
 * since PROBE_INGEST_TOKEN's old flat env-var secret predates Team-based
 * multi-tenancy — with a single shared token, two teams roasting at the
 * same time would have had the newer session silently steal the older
 * one's readings. A reading can land here before startedAt is set (roast
 * still in setup) — atSeconds is just null then, which is also how the UI
 * tells "probe connected" apart from "no probe" without a manual toggle.
 */
export async function POST(request: NextRequest) {
  const probeToken = await resolveProbeRequest(request);
  if (!probeToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const tempFahrenheit = typeof body?.tempFahrenheit === "number" ? body.tempFahrenheit : null;
  const probeType = typeof body?.probeType === "string" && body.probeType.trim() ? body.probeType.trim() : "bean";

  if (tempFahrenheit === null) {
    return NextResponse.json({ error: "tempFahrenheit (number) is required." }, { status: 400 });
  }

  const activeSession = await prisma.roastSession.findFirst({
    where: { endedAt: null, teamId: probeToken.teamId },
    orderBy: { createdAt: "desc" },
  });

  if (!activeSession) {
    return NextResponse.json({ error: "No active roast session." }, { status: 404 });
  }

  const atSeconds = activeSession.startedAt
    ? Math.round((Date.now() - activeSession.startedAt.getTime()) / 1000)
    : null;

  const reading = await prisma.temperatureReading.create({
    data: { roastSessionId: activeSession.id, tempFahrenheit, probeType, atSeconds },
  });

  return NextResponse.json({ ok: true, id: reading.id, roastSessionId: activeSession.id, atSeconds });
}
