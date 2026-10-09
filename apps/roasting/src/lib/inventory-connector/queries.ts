/**
 * Read-side data functions for the inventory app — the query half of the
 * connector. Every function is team-scoped via requireUser; the inventory
 * UI never touches Prisma or the roasting app's lib directly.
 */

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/admin";
import { computeRunway, sortByUrgency } from "./runway";

/**
 * Pure helpers the inventory UI needs, re-exported through the connector
 * so inventory code never imports the roasting app's lib directly.
 * (Re-exports are only dangerous from "use server" modules — this file
 * isn't one.) Client-safe bits come from ./client so "use client"
 * components have a Prisma-free import site — see that file's header.
 */
export { formatPlanMonth, defaultPlanMonth, PLAN_STATUSES } from "@/lib/plans";
export { computeCuppingTotal, SCORE_LABELS, ALL_SCORE_FIELDS } from "@/lib/cupping";
export { formatCurrency, ROAST_LEVELS, INVENTORY_WIDGETS } from "./client";
export type { InventoryWidgetKey } from "./client";
export {
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  LEAD_UPDATE_KINDS,
  LEAD_UPDATE_LABELS,
  OPEN_STATUSES,
  allocationWeight,
} from "@/lib/leads";

/** Lots (beans) with the roast history needed for alerts, yield, and cost math. */
export async function getInventoryLots() {
  const user = await requireUser();
  return prisma.bean.findMany({
    where: { teamId: user.teamId },
    include: {
      roastSessions: {
        select: { startedAt: true, greenWeightGrams: true, roastedWeightGrams: true },
      },
    },
    orderBy: { purchaseDate: "desc" },
  });
}

export async function getLot(id: string) {
  const user = await requireUser();
  return prisma.bean.findFirst({
    where: { id, teamId: user.teamId },
    include: {
      roastSessions: {
        orderBy: { startedAt: "desc" },
        include: { cuppingNotes: { orderBy: { cuppedAt: "desc" } } },
      },
      lotCuppingNotes: { orderBy: { cuppedAt: "desc" } },
    },
  });
}

/** Recent roast sessions across all lots, for the roast log. */
export async function getRecentRoasts(limit = 30) {
  const user = await requireUser();
  return prisma.roastSession.findMany({
    where: { teamId: user.teamId, startedAt: { not: null } },
    include: { bean: { select: { id: true, name: true } } },
    orderBy: { startedAt: "desc" },
    take: limit,
  });
}

/** Roaster definitions for the Artisan import form. */
export async function getRoasterDefinitions() {
  const user = await requireUser();
  return prisma.roasterDefinition.findMany({
    where: { teamId: user.teamId },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });
}

/** Monthly production plans, newest first. */
export async function getPlans() {
  const user = await requireUser();
  return prisma.productionPlan.findMany({
    where: { teamId: user.teamId },
    include: { bean: { select: { id: true, name: true } } },
    orderBy: { month: "desc" },
  });
}

/** Green roasted in a YYYY-MM month, optionally for one lot. */
export async function getRoastedInMonth(month: string, beanId?: string) {
  const user = await requireUser();
  const [y, m] = month.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  const sessions = await prisma.roastSession.findMany({
    where: {
      teamId: user.teamId,
      startedAt: { gte: start, lt: end },
      ...(beanId ? { beanId } : {}),
    },
    select: { greenWeightGrams: true },
  });
  return sessions.reduce((sum, s) => sum + s.greenWeightGrams, 0);
}

/** Blend recipes with their component lots. */
export async function getBlends() {
  const user = await requireUser();
  return prisma.blendRecipe.findMany({
    where: { teamId: user.teamId },
    include: {
      components: {
        include: { bean: { select: { id: true, name: true, remainingGrams: true } } },
        orderBy: { ratioPercent: "desc" },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
}

/** All lot cupping notes, newest first. CuppingNote has no teamId of its
 * own — team scoping goes through the lot's bean. */
export async function getLotCuppingNotes() {
  const user = await requireUser();
  return prisma.cuppingNote.findMany({
    where: { beanId: { not: null }, bean: { teamId: user.teamId } },
    include: { bean: { select: { id: true, name: true } } },
    orderBy: { cuppedAt: "desc" },
  });
}

/** Which dashboard widgets this team has hidden. Never throws — a team
 * without a prefs row just gets the defaults (everything visible). */
export async function getWidgetPrefs(): Promise<string[]> {
  const user = await requireUser();
  const prefs = await prisma.inventoryWidgetPrefs.findUnique({
    where: { teamId: user.teamId },
  });
  if (!prefs) return [];
  try {
    const parsed: unknown = JSON.parse(prefs.hiddenWidgets);
    return Array.isArray(parsed) ? parsed.filter((w): w is string => typeof w === "string") : [];
  } catch {
    return [];
  }
}


/**
 * Runway for every lot: free green after lead commitments, burn rate,
 * stock-out and order-by dates. One query per table (not per lot) — see
 * AGENTS.md's Performance section on why fewer round trips matter here.
 */
export async function getRunway() {
  const user = await requireUser();
  const [lots, allocations, plans] = await Promise.all([
    prisma.bean.findMany({
      where: { teamId: user.teamId },
      include: {
        roastSessions: {
          select: { startedAt: true, greenWeightGrams: true, roastedWeightGrams: true },
        },
      },
    }),
    prisma.leadAllocation.findMany({
      where: { lead: { teamId: user.teamId } },
      include: { lead: { select: { status: true } } },
    }),
    prisma.productionPlan.findMany({ where: { teamId: user.teamId } }),
  ]);

  // Green already roasted per lot per plan month, from the sessions already
  // loaded — no extra queries.
  const roastedByKey = new Map<string, number>();
  for (const lot of lots) {
    for (const s of lot.roastSessions) {
      if (!s.startedAt) continue;
      const key = `${lot.id}|${s.startedAt.toISOString().slice(0, 7)}`;
      roastedByKey.set(key, (roastedByKey.get(key) ?? 0) + s.greenWeightGrams);
    }
  }

  const rows = computeRunway(
    lots.map((l) => ({
      id: l.id,
      name: l.name,
      origin: l.origin,
      remainingGrams: l.remainingGrams,
      leadTimeDays: l.leadTimeDays,
      roastSessions: l.roastSessions,
    })),
    allocations,
    plans,
    (beanId, month) => roastedByKey.get(`${beanId}|${month}`) ?? 0
  );
  return sortByUrgency(rows);
}

/** All leads with their allocations, most recently touched first. */
export async function getLeads() {
  const user = await requireUser();
  return prisma.lead.findMany({
    where: { teamId: user.teamId },
    include: {
      allocations: { include: { bean: { select: { id: true, name: true } } } },
      updates: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getLead(id: string) {
  const user = await requireUser();
  return prisma.lead.findFirst({
    where: { id, teamId: user.teamId },
    include: {
      allocations: {
        include: { bean: { select: { id: true, name: true, remainingGrams: true } } },
        orderBy: { createdAt: "desc" },
      },
      updates: { orderBy: { createdAt: "desc" } },
    },
  });
}
