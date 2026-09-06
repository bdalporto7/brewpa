import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveSyncRequest } from "@/lib/sync-tokens";

/**
 * A full current snapshot of the caller's team, not an incremental diff —
 * at this app's real scale (dozens of rows per model) a snapshot is
 * simpler than reconciling models that don't all have `updatedAt`, and
 * sidesteps needing to express "this row was deleted" that a pure diff
 * can't do without a tombstone table this schema doesn't have (a known,
 * accepted v1 limitation — see the sync project's plan).
 *
 * Deliberately excludes TemperatureReading (no updatedAt, arrives every
 * few seconds during a live roast — fetched on demand instead, see
 * src/app/api/sync/roasts/[id]/temperature-readings/route.ts) and never
 * returns raw AllowedUser rows beyond { id, name } for the team itself —
 * no reason to put teammates' emails on someone's laptop.
 */
export async function GET(request: NextRequest) {
  const token = await resolveSyncRequest(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { teamId } = token.user;
  const userId = token.userId;

  const [
    team,
    beans,
    roastProfiles,
    friends,
    recipes,
    roastSessions,
    roastEvents,
    sales,
    cuppingNotes,
    drops,
    dropOrders,
    dropOrderItems,
    brews,
  ] = await Promise.all([
    prisma.team.findUniqueOrThrow({ where: { id: teamId }, select: { id: true, name: true } }),
    prisma.bean.findMany({ where: { teamId } }),
    prisma.roastProfile.findMany({ where: { teamId } }),
    prisma.friend.findMany({ where: { teamId } }),
    prisma.recipe.findMany({ where: { teamId } }),
    prisma.roastSession.findMany({ where: { teamId } }),
    prisma.roastEvent.findMany({ where: { roastSession: { teamId } } }),
    prisma.sale.findMany({ where: { roastSession: { teamId } } }),
    prisma.cuppingNote.findMany({ where: { roastSession: { teamId } } }),
    prisma.drop.findMany({ where: { teamId }, include: { beans: { select: { id: true } } } }),
    prisma.dropOrder.findMany({ where: { drop: { teamId } } }),
    prisma.dropOrderItem.findMany({ where: { dropOrder: { drop: { teamId } } } }),
    prisma.brew.findMany({ where: { userId } }),
  ]);

  return NextResponse.json({
    team,
    beans,
    roastProfiles,
    friends,
    recipes,
    roastSessions,
    roastEvents,
    sales,
    cuppingNotes,
    drops: drops.map(({ beans: dropBeans, ...drop }) => ({ ...drop, beanIds: dropBeans.map((b) => b.id) })),
    dropOrders,
    dropOrderItems,
    brews,
  });
}
