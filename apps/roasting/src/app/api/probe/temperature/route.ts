import { timingSafeEqual } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Machine credential, not a user session — whatever script reads the
 * physical probe authenticates with a flat bearer token (PROBE_INGEST_TOKEN)
 * rather than signing in. Excluded from proxy.ts's session gate for exactly
 * that reason, same as /api/auth is excluded for the opposite one.
 */
function isAuthorized(request: NextRequest): boolean {
  const expected = process.env.PROBE_INGEST_TOKEN;
  if (!expected) return false;

  const header = request.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return false;

  const provided = Buffer.from(token);
  const secret = Buffer.from(expected);
  return provided.length === secret.length && timingSafeEqual(provided, secret);
}

/**
 * Always logs against whichever RoastSession is currently active
 * (endedAt: null) rather than requiring the caller to know a session id —
 * this app only ever has one roast in flight at a time, so "the active
 * one" is unambiguous, and it's what lets the probe script stay completely
 * dumb: point it at this endpoint once, it never needs to know the roast
 * has changed. A reading can land here before startedAt is set (roast
 * still in setup) — atSeconds is just null then, which is also how the UI
 * tells "probe connected" apart from "no probe" without a manual toggle.
 */
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const tempFahrenheit = typeof body?.tempFahrenheit === "number" ? body.tempFahrenheit : null;
  const probeType = typeof body?.probeType === "string" && body.probeType.trim() ? body.probeType.trim() : "bean";

  if (tempFahrenheit === null) {
    return NextResponse.json({ error: "tempFahrenheit (number) is required." }, { status: 400 });
  }

  const activeSession = await prisma.roastSession.findFirst({
    where: { endedAt: null },
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
