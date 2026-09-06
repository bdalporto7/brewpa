import * as fs from "node:fs";
import { prisma } from "@/lib/prisma";

type Row = Record<string, unknown>;

/**
 * Reads the token Phase 1's auth.ts signIn callback already wrote into
 * desktop-config.json (same file main.ts's readDesktopConfig() reads) —
 * no separate credential store, no IPC round trip to get it. Duplicated
 * read logic rather than a shared import: there's no module boundary
 * between apps/desktop and apps/roasting to import across (same reason
 * DESKTOP_GUEST_EMAIL is duplicated between auth.ts and migrate.ts).
 */
function readSyncConfig(): { apiBase: string; token: string } | null {
  const configPath = process.env.DESKTOP_CONFIG_PATH;
  const apiBase = process.env.SYNC_API_BASE_URL;
  if (!configPath || !apiBase) return null;

  try {
    const raw = fs.readFileSync(configPath, "utf8");
    const parsed = JSON.parse(raw);
    if (typeof parsed?.syncToken !== "string") return null;
    return { apiBase, token: parsed.syncToken };
  } catch {
    return null;
  }
}

/** Every row currently in the 12 synced local tables, in the same flat shape /api/sync/push expects. Sent in full every cycle — see this file's own header comment on why that's the right tradeoff at this app's scale. */
async function collectLocalRows() {
  const [
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
    prisma.bean.findMany(),
    prisma.roastProfile.findMany(),
    prisma.friend.findMany(),
    prisma.recipe.findMany(),
    prisma.roastSession.findMany(),
    prisma.roastEvent.findMany(),
    prisma.sale.findMany(),
    prisma.cuppingNote.findMany(),
    prisma.drop.findMany({ include: { beans: { select: { id: true } } } }),
    prisma.dropOrder.findMany(),
    prisma.dropOrderItem.findMany(),
    prisma.brew.findMany(),
  ]);

  return {
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
  };
}

async function push(apiBase: string, token: string): Promise<number> {
  const body = await collectLocalRows();
  const res = await fetch(`${apiBase}/api/sync/push`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Push failed: ${res.status} ${await res.text().catch(() => "")}`);
  const rowCount = Object.values(body).reduce((sum, rows) => sum + rows.length, 0);
  return rowCount;
}

/** DateTime fields arrive as ISO strings over JSON — the local SQLite adapter needs real Date objects. */
function toDates(row: Row, fields: string[]): Row {
  const out = { ...row };
  for (const f of fields) {
    if (typeof out[f] === "string") out[f] = new Date(out[f] as string);
  }
  return out;
}

/**
 * Upserts one incoming row into the local db, by id. Every field —
 * including teamId/userId — gets overwritten on a match: a local install
 * only ever holds one team's data, so there's no ownership check to make
 * the way /api/sync/push has to make one, but a full overwrite matters
 * for a specific reconciliation case — a row created locally before sign-
 * in still carries the local guest's own team id (or, for Brew, the local
 * guest AllowedUser's own id) in its local copy until this exact pull
 * rewrites it to match what push (running just before this, in the same
 * sync cycle) just corrected on the remote.
 */
async function upsertLocal(
  delegate: { findUnique: Function; create: Function; update: Function },
  row: Row,
  dateFields: string[],
  hasUpdatedAt: boolean
): Promise<void> {
  const id = row.id as string;
  const data = toDates(row, dateFields);
  const existing = await (delegate as any).findUnique({ where: { id } });

  if (!existing) {
    await (delegate as any).create({ data });
    return;
  }

  // Ownership is corrected unconditionally, never gated on the content
  // freshness check below — push (already run this same cycle) re-stamps
  // teamId/userId server-side without touching updatedAt, so a row's
  // *content* can look unchanged (same-or-newer locally, nothing to
  // merge) while its ownership still needs fixing. Checked generically
  // since which of the two a given model even has varies (Brew has only
  // userId; everything else synced here has only teamId).
  for (const ownerField of ["teamId", "userId"] as const) {
    if (typeof (existing as Row)[ownerField] === "string" && row[ownerField] !== existing[ownerField]) {
      await (delegate as any).update({ where: { id }, data: { [ownerField]: row[ownerField] } });
    }
  }

  if (hasUpdatedAt) {
    const incoming = row.updatedAt ? new Date(row.updatedAt as string) : null;
    if (incoming && existing.updatedAt && incoming <= existing.updatedAt) return;
  }
  await (delegate as any).update({ where: { id }, data });
}

async function pull(apiBase: string, token: string): Promise<number> {
  const res = await fetch(`${apiBase}/api/sync/pull`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Pull failed: ${res.status} ${await res.text().catch(() => "")}`);
  const snapshot = (await res.json()) as {
    team: { id: string; name: string };
    me: { id: string; email: string; isAdmin: boolean };
  } & Record<string, Row[]>;

  // Every team-owned model below has a foreign key to Team — that row has
  // to exist locally before any of them can, and a fresh local install
  // has no Team matching the *remote* one at all (only its own local
  // guest team, seeded by migrate.ts). Upserted here first, always.
  await prisma.team.upsert({
    where: { id: snapshot.team.id },
    create: { id: snapshot.team.id, name: snapshot.team.name },
    update: { name: snapshot.team.name },
  });

  // Same deal for AllowedUser: Brew.userId is a real foreign key, and the
  // local db has never heard of the remote person's AllowedUser row (pull
  // never sends teammates' rows — see the route's own comment — only this
  // caller's own `me`). By a fresh id, not the local guest row's id: they're
  // different accounts that happen to share one laptop's local file, not
  // the same account renamed, so nothing here deletes or repoints the
  // guest row itself. Any Brews the guest created before sign-in get their
  // own ownership corrected onto this new row below, same as team-owned
  // rows get their teamId corrected — see upsertLocal.
  await prisma.allowedUser.upsert({
    where: { id: snapshot.me.id },
    create: { id: snapshot.me.id, email: snapshot.me.email, isAdmin: snapshot.me.isAdmin, teamId: snapshot.team.id },
    update: { email: snapshot.me.email, isAdmin: snapshot.me.isAdmin, teamId: snapshot.team.id },
  });

  for (const row of snapshot.friends ?? []) await upsertLocal(prisma.friend, row, ["createdAt", "updatedAt"], true);
  for (const row of snapshot.recipes ?? []) await upsertLocal(prisma.recipe, row, ["createdAt", "updatedAt"], true);
  for (const row of snapshot.roastProfiles ?? []) await upsertLocal(prisma.roastProfile, row, ["createdAt", "updatedAt"], true);
  for (const row of snapshot.beans ?? []) {
    await upsertLocal(prisma.bean, { ...row, goldenRoastId: null }, ["purchaseDate", "tastingNotesFetchedAt", "createdAt", "updatedAt"], true);
  }
  for (const row of snapshot.roastSessions ?? []) {
    await upsertLocal(
      prisma.roastSession,
      { ...row, compareToId: null },
      ["startedAt", "endedAt", "aiSuggestionAcceptedAt", "createdAt", "updatedAt"],
      true
    );
  }
  // Relink the two deferred self-references now that every RoastSession this snapshot could point at exists locally.
  for (const row of snapshot.beans ?? []) {
    if (row.goldenRoastId) await prisma.bean.update({ where: { id: row.id as string }, data: { goldenRoastId: row.goldenRoastId as string } }).catch(() => {});
  }
  for (const row of snapshot.roastSessions ?? []) {
    if (row.compareToId) await prisma.roastSession.update({ where: { id: row.id as string }, data: { compareToId: row.compareToId as string } }).catch(() => {});
  }
  for (const row of snapshot.drops ?? []) {
    const { beanIds, ...dropRow } = row as Row & { beanIds?: string[] };
    const id = dropRow.id as string;
    const data = toDates(dropRow, ["closedAt", "createdAt", "updatedAt"]);
    const beanConnect = { set: (beanIds ?? []).map((beanId) => ({ id: beanId })) };
    const existing = await prisma.drop.findUnique({ where: { id } });
    if (!existing) {
      await prisma.drop.create({ data: { ...data, beans: { connect: (beanIds ?? []).map((beanId) => ({ id: beanId })) } } as never });
    } else {
      // Same unconditional ownership correction as upsertLocal — push
      // re-stamps teamId without touching updatedAt, so this can't be
      // gated on the freshness check below.
      if (dropRow.teamId !== existing.teamId) {
        await prisma.drop.update({ where: { id }, data: { teamId: dropRow.teamId as string } });
      }
      const incoming = row.updatedAt ? new Date(row.updatedAt as string) : null;
      if (!incoming || !existing.updatedAt || incoming > existing.updatedAt) {
        await prisma.drop.update({ where: { id }, data: { ...data, beans: beanConnect } as never });
      }
    }
  }
  for (const row of snapshot.roastEvents ?? []) await upsertLocal(prisma.roastEvent, row, ["createdAt"], false);
  for (const row of snapshot.sales ?? []) await upsertLocal(prisma.sale, row, ["soldAt", "createdAt"], false);
  for (const row of snapshot.cuppingNotes ?? []) await upsertLocal(prisma.cuppingNote, row, ["cuppedAt", "createdAt", "updatedAt"], true);
  for (const row of snapshot.dropOrders ?? []) await upsertLocal(prisma.dropOrder, row, ["createdAt"], false);
  for (const row of snapshot.dropOrderItems ?? []) await upsertLocal(prisma.dropOrderItem, row, ["createdAt"], false);
  for (const row of snapshot.brews ?? []) await upsertLocal(prisma.brew, row, ["brewedAt", "createdAt", "updatedAt"], true);

  return Object.values(snapshot).reduce((sum, rows) => sum + (Array.isArray(rows) ? rows.length : 0), 0);
}

export async function runSync(): Promise<{ ok: boolean; pushed?: number; pulled?: number; error?: string }> {
  const config = readSyncConfig();
  if (!config) {
    return { ok: false, error: "Sync isn't set up for this install." };
  }

  try {
    // Push before pull, always — an edit made locally since the last sync
    // has to land on the remote before this cycle's pull could otherwise
    // overwrite it with an older remote copy.
    const pushed = await push(config.apiBase, config.token);
    const pulled = await pull(config.apiBase, config.token);
    return { ok: true, pushed, pulled };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
