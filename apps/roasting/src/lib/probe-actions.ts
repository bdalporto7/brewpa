"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/admin";

/**
 * The in-browser Web Serial probe connector's ingest path — a real signed-
 * in Server Action, not the bearer-token /api/probe/temperature route the
 * local bridge script uses. Deliberately not reusing that route: it finds
 * "the" active roast session with no teamId scoping at all (a single
 * global PROBE_INGEST_TOKEN predates multi-team support and was never
 * updated for it — harmless while this app only had one real team, a
 * genuine cross-team mixup waiting to happen the moment a second one runs
 * the bridge script at the same time as this one). A page already knows
 * who's signed in, so scoping to their team here costs nothing and sidesteps
 * that whole class of bug for this path from day one.
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
