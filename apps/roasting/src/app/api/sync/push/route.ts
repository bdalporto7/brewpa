import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveSyncRequest } from "@/lib/sync-tokens";

type Row = Record<string, unknown>;

/** DateTime fields arrive as ISO strings over JSON — Prisma's SQLite adapter needs real Date objects, not strings, for these. */
function toDates(row: Row, fields: string[]): Row {
  const out = { ...row };
  for (const f of fields) {
    if (typeof out[f] === "string") out[f] = new Date(out[f] as string);
  }
  return out;
}

/** Strips whatever the client sent for a server-stamped field before it ever reaches Prisma — teamId/userId are never trusted from the request body. */
function omit(row: Row, keys: string[]): Row {
  const out = { ...row };
  for (const k of keys) delete out[k];
  return out;
}

/**
 * Upsert-by-id with last-writer-wins semantics, for the models that carry
 * a real `updatedAt` (Bean/RoastSession/RoastProfile/CuppingNote/Friend/
 * Drop/Recipe/Brew). Insert-only (migrate-to-remote.ts's old model) was
 * fine for a one-time migration under a single-writer-per-file assumption
 * that ongoing two-way sync makes false — two devices can now genuinely
 * both edit the same already-synced row, and insert-only would silently
 * and permanently drop the second edit.
 */
async function upsertOwned(
  delegate: { findFirst: Function; create: Function; update: Function },
  row: Row,
  ownerField: "teamId" | "userId",
  ownerId: string,
  dateFields: string[]
): Promise<void> {
  const id = row.id as string;
  const data = toDates(omit(row, ["teamId", "userId"]), dateFields);
  const existing = await (delegate as any).findFirst({ where: { id, [ownerField]: ownerId } });

  if (!existing) {
    await (delegate as any).create({ data: { ...data, [ownerField]: ownerId } });
    return;
  }
  const incomingUpdatedAt = row.updatedAt ? new Date(row.updatedAt as string) : null;
  if (incomingUpdatedAt && existing.updatedAt && incomingUpdatedAt <= existing.updatedAt) {
    return; // remote's version is already newer or the same — nothing to do
  }
  await (delegate as any).update({ where: { id }, data });
}

/** Insert-if-missing for the no-updatedAt event-log tables — nothing in src/lib ever updates one of these rows after creation, so there's no "which is newer" question to ask. */
async function insertIfMissing(
  delegate: { findUnique: Function; create: Function },
  row: Row,
  dateFields: string[]
): Promise<boolean> {
  const id = row.id as string;
  const existing = await (delegate as any).findUnique({ where: { id } });
  if (existing) return false;
  await (delegate as any).create({ data: toDates(row, dateFields) });
  return true;
}

export async function POST(request: NextRequest) {
  const token = await resolveSyncRequest(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { teamId } = token.user;
  const userId = token.userId;

  const body = (await request.json().catch(() => null)) as Record<string, Row[] | undefined> | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const skipped: string[] = [];

  // Independent tables first.
  for (const row of body.friends ?? []) {
    await upsertOwned(prisma.friend, row, "teamId", teamId, ["createdAt", "updatedAt"]);
  }
  for (const row of body.recipes ?? []) {
    await upsertOwned(prisma.recipe, row, "teamId", teamId, ["createdAt", "updatedAt"]);
  }
  for (const row of body.roastProfiles ?? []) {
    await upsertOwned(prisma.roastProfile, row, "teamId", teamId, ["createdAt", "updatedAt"]);
  }

  // Bean before RoastSession (required FK); goldenRoastId deferred until
  // every RoastSession this batch might reference has landed.
  for (const row of body.beans ?? []) {
    await upsertOwned(prisma.bean, { ...row, goldenRoastId: null }, "teamId", teamId, [
      "purchaseDate",
      "tastingNotesFetchedAt",
      "createdAt",
      "updatedAt",
    ]);
  }
  for (const row of body.roastSessions ?? []) {
    // A RoastSession's beanId is trusted only once confirmed to actually
    // belong to this team — otherwise a crafted payload could attach a
    // roast to another team's bean by id.
    const bean = await prisma.bean.findFirst({ where: { id: row.beanId as string, teamId } });
    if (!bean) {
      skipped.push(`roastSession ${row.id}: beanId doesn't belong to this team`);
      continue;
    }
    await upsertOwned(prisma.roastSession, { ...row, compareToId: null }, "teamId", teamId, [
      "startedAt",
      "endedAt",
      "aiSuggestionAcceptedAt",
      "createdAt",
      "updatedAt",
    ]);
  }

  // Relink the two deferred self-references, now that every RoastSession
  // this batch could point at (old or newly-pushed) actually exists.
  for (const row of body.beans ?? []) {
    if (!row.goldenRoastId) continue;
    const target = await prisma.roastSession.findFirst({ where: { id: row.goldenRoastId as string, teamId } });
    if (target) {
      await prisma.bean.update({ where: { id: row.id as string }, data: { goldenRoastId: target.id } });
    } else {
      skipped.push(`bean ${row.id}: goldenRoastId ${row.goldenRoastId} not found on this team, left unset`);
    }
  }
  for (const row of body.roastSessions ?? []) {
    if (!row.compareToId) continue;
    const target = await prisma.roastSession.findFirst({ where: { id: row.compareToId as string, teamId } });
    if (target) {
      await prisma.roastSession.update({ where: { id: row.id as string }, data: { compareToId: target.id } });
    } else {
      skipped.push(`roastSession ${row.id}: compareToId ${row.compareToId} not found on this team, left unset`);
    }
  }

  // Drop — beanIds connect handles the implicit Bean<->Drop join table
  // Prisma generates under the hood (migrate-to-remote.ts's raw-SQL
  // approach had no way to see that hidden table at all; a drop's bean
  // list was silently lost on migration before this).
  for (const row of body.drops ?? []) {
    const { beanIds, ...dropRow } = row as Row & { beanIds?: string[] };
    const requestedIds = beanIds ?? [];
    const ownedBeans = await prisma.bean.findMany({ where: { id: { in: requestedIds }, teamId } });
    if (ownedBeans.length !== requestedIds.length) {
      skipped.push(`drop ${row.id}: one or more beanIds don't belong to this team`);
      continue;
    }
    const id = dropRow.id as string;
    const data = toDates(omit(dropRow, ["teamId"]), ["closedAt", "createdAt", "updatedAt"]);
    const beanConnections = ownedBeans.map((b) => ({ id: b.id }));
    const existing = await prisma.drop.findFirst({ where: { id, teamId } });
    if (!existing) {
      await prisma.drop.create({ data: { ...data, teamId, beans: { connect: beanConnections } } as never });
    } else {
      const incomingUpdatedAt = row.updatedAt ? new Date(row.updatedAt as string) : null;
      if (!incomingUpdatedAt || !existing.updatedAt || incomingUpdatedAt > existing.updatedAt) {
        await prisma.drop.update({ where: { id }, data: { ...data, beans: { set: beanConnections } } as never });
      }
    }
  }

  // Everything below hangs off a RoastSession/Drop that's already
  // guaranteed team-scoped above — each item's own parent is still
  // re-checked here, since these tables carry no teamId of their own and
  // a crafted payload could otherwise point one at a different team's
  // parent by id.
  for (const row of body.roastEvents ?? []) {
    const session = await prisma.roastSession.findFirst({ where: { id: row.roastSessionId as string, teamId } });
    if (!session) {
      skipped.push(`roastEvent ${row.id}: roastSessionId doesn't belong to this team`);
      continue;
    }
    await insertIfMissing(prisma.roastEvent, row, ["createdAt"]);
  }
  for (const row of body.sales ?? []) {
    const session = await prisma.roastSession.findFirst({ where: { id: row.roastSessionId as string, teamId } });
    if (!session) {
      skipped.push(`sale ${row.id}: roastSessionId doesn't belong to this team`);
      continue;
    }
    if (row.friendId) {
      const friend = await prisma.friend.findFirst({ where: { id: row.friendId as string, teamId } });
      if (!friend) {
        skipped.push(`sale ${row.id}: friendId doesn't belong to this team`);
        continue;
      }
    }
    await insertIfMissing(prisma.sale, row, ["soldAt", "createdAt"]);
  }
  for (const row of body.cuppingNotes ?? []) {
    const session = await prisma.roastSession.findFirst({ where: { id: row.roastSessionId as string, teamId } });
    if (!session) {
      skipped.push(`cuppingNote ${row.id}: roastSessionId doesn't belong to this team`);
      continue;
    }
    // CuppingNote has no teamId of its own to scope a generic upsert
    // helper against — ownership is via roastSessionId, already checked
    // above — so this upserts directly by id rather than reusing
    // upsertOwned (which needs an owner column to filter findFirst on).
    const id = row.id as string;
    const data = toDates(row, ["cuppedAt", "createdAt", "updatedAt"]);
    const existing = await prisma.cuppingNote.findUnique({ where: { id } });
    if (!existing) {
      await prisma.cuppingNote.create({ data: data as never });
    } else {
      const incomingUpdatedAt = row.updatedAt ? new Date(row.updatedAt as string) : null;
      if (!incomingUpdatedAt || !existing.updatedAt || incomingUpdatedAt > existing.updatedAt) {
        await prisma.cuppingNote.update({ where: { id }, data: data as never });
      }
    }
  }
  for (const row of body.dropOrders ?? []) {
    const drop = await prisma.drop.findFirst({ where: { id: row.dropId as string, teamId } });
    if (!drop) {
      skipped.push(`dropOrder ${row.id}: dropId doesn't belong to this team`);
      continue;
    }
    await insertIfMissing(prisma.dropOrder, row, ["createdAt"]);
  }
  for (const row of body.dropOrderItems ?? []) {
    const order = await prisma.dropOrder.findFirst({ where: { id: row.dropOrderId as string, drop: { teamId } } });
    if (!order) {
      skipped.push(`dropOrderItem ${row.id}: dropOrderId doesn't belong to this team`);
      continue;
    }
    const bean = await prisma.bean.findFirst({ where: { id: row.beanId as string, teamId } });
    if (!bean) {
      skipped.push(`dropOrderItem ${row.id}: beanId doesn't belong to this team`);
      continue;
    }
    await insertIfMissing(prisma.dropOrderItem, row, ["createdAt"]);
  }

  // Brew is individually owned (userId), not team-owned — same
  // never-trust-the-body rule, just keyed off the token's own user.
  for (const row of body.brews ?? []) {
    await upsertOwned(prisma.brew, row, "userId", userId, ["brewedAt", "createdAt", "updatedAt"]);
  }

  return NextResponse.json({ ok: true, skipped });
}
