import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MILESTONE_EVENT_TYPES } from "@/lib/constants";

/**
 * Polled by Electron's main process (apps/desktop/src-ts/desktop-status.ts),
 * never by a browser — see proxy.ts's comment on why this route is
 * excluded from the session gate. Deliberately 404s outside the desktop
 * app: the hosted deployment has no single "the active roast" (this app
 * only ever supports one roast in flight at a time, which only makes
 * sense per-installation, not across every user of the hosted app).
 *
 * Reports only *real, already-logged* milestones (RoastEvent rows the
 * roaster themselves marked) and endedAt, not a prediction of what's
 * coming next — src/lib/tips.ts's projectNextMilestone does that, but it
 * needs reference-roast baselines assembled with the same care the roast
 * detail page already gives it. Wiring that into a lightweight polled
 * status endpoint is a reasonable future step, not this one.
 */
export async function GET() {
  if (process.env.APP_MODE !== "desktop") {
    return NextResponse.json({ error: "Desktop-only endpoint" }, { status: 404 });
  }

  const session = await prisma.roastSession.findFirst({
    where: { endedAt: null },
    include: {
      bean: { select: { name: true } },
      events: {
        where: { type: { in: MILESTONE_EVENT_TYPES } },
        orderBy: { atSeconds: "desc" },
        take: 1,
      },
      temperatureReadings: {
        orderBy: { recordedAt: "desc" },
        take: 1,
      },
    },
  });

  if (!session || !session.startedAt) {
    return NextResponse.json({ active: false });
  }

  const latestMilestone = session.events[0] ?? null;
  const latestReading = session.temperatureReadings[0] ?? null;

  return NextResponse.json({
    active: true,
    roastId: session.id,
    beanName: session.bean.name,
    startedAt: session.startedAt.toISOString(),
    latestTempF: latestReading?.tempFahrenheit ?? null,
    latestMilestone: latestMilestone ? { type: latestMilestone.type, atSeconds: latestMilestone.atSeconds } : null,
  });
}
