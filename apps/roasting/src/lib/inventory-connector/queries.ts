/**
 * Read-side data functions for the inventory app — the query half of the
 * connector. Every function is team-scoped via requireUser; the inventory
 * UI never touches Prisma or the roasting app's lib directly.
 */

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/admin";

/**
 * Pure helpers the inventory UI needs, re-exported through the connector
 * so inventory code never imports the roasting app's lib directly.
 * (Re-exports are only dangerous from "use server" modules — this file
 * isn't one.)
 */
export { formatPlanMonth, defaultPlanMonth, PLAN_STATUSES } from "@/lib/plans";
export { computeCuppingTotal, SCORE_LABELS, ALL_SCORE_FIELDS } from "@/lib/cupping";
export { formatCurrency } from "@/lib/format";
export { ROAST_LEVELS } from "@/lib/constants";

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

/** All widget keys the dashboard knows how to render. */
export const INVENTORY_WIDGETS = [
  { key: "stats", label: "Totals" },
  { key: "alerts", label: "Needs attention" },
  { key: "lots", label: "Your lots" },
  { key: "roasts", label: "Recent roasts" },
  { key: "plan", label: "This month's plan" },
  { key: "costs", label: "Inventory value" },
] as const;

export type InventoryWidgetKey = (typeof INVENTORY_WIDGETS)[number]["key"];
