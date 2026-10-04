/**
 * Pure (non-server) helpers for ProductionPlan. These live outside
 * plan-actions.ts on purpose: "use server" modules only export async
 * functions to client components, so shared constants and formatting
 * helpers belong here where both server and client code can import them.
 */

export const PLAN_STATUSES = ["planned", "in-progress", "completed"] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

/** "October 2026" from "2026-10" — derived for display, never stored. */
export function formatPlanMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, 1));
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

/** The next roast month (YYYY-MM) — the business buys green 1st–15th to
 * roast/fulfill the following month, so the sensible default for a new
 * plan is next month. Derived, not stored. */
export function defaultPlanMonth(): string {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return next.toISOString().slice(0, 7);
}
