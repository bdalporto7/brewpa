"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/admin";

/**
 * The in-browser Web Serial probe connector's ingest path — a real signed-
 * in Server Action, not the bearer-token /api/probe/temperature route the
 * local bridge script uses (that route now resolves a per-team ProbeToken,
 * src/lib/probe-tokens.ts, to get the same teamId scoping below — it used
 * to find "the" active roast session with no team scoping at all, back
 * when every team shared one flat PROBE_INGEST_TOKEN). A page already
 * knows who's signed in, so scoping to their team here has always been
 * free — this path never had that bug.
 */
export async function logProbeReading(tempFahrenheit: number, probeType: string = "bean") {
  const user = await requireUser();

  const activeSession = await prisma.roastSession.findFirst({
    where: { endedAt: null, teamId: user.teamId },
    orderBy: { createdAt: "desc" },
  });
  if (!activeSession) {
    return { ok: false as const, error: "No active roast session." };
  }

  const atSeconds = activeSession.startedAt
    ? Math.round((Date.now() - activeSession.startedAt.getTime()) / 1000)
    : null;

  await prisma.temperatureReading.create({
    data: { roastSessionId: activeSession.id, tempFahrenheit, probeType, atSeconds },
  });

  return { ok: true as const };
}
