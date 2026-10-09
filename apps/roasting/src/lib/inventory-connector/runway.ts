/**
 * Stock runway projection — pure functions, no DB access. For each lot:
 * how much green is really free (on hand minus what's earmarked for
 * leads), how fast it's being roasted, and so when it runs out and by
 * when to reorder.
 *
 * "Derived, not stored": nothing here is persisted; the dashboard and
 * /inventory/runway recompute it on every request from lots, roast
 * history, plans and lead allocations.
 */

import { allocationWeight } from "@/lib/leads";
import { DEFAULT_LOSS_PERCENT, greenNeeded, measuredLossPercent } from "./math";

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const BURN_WINDOW_DAYS = 90;
const DEFAULT_LEAD_TIME_DAYS = 14;

export interface RunwayLot {
  id: string;
  name: string;
  origin: string;
  remainingGrams: number;
  leadTimeDays: number | null;
  roastSessions: { startedAt: Date | null; greenWeightGrams: number; roastedWeightGrams: number | null }[];
}

export interface RunwayAllocation {
  beanId: string;
  roastedGrams: number;
  fulfilledAt: Date | null;
  lead: { status: string };
}

export interface RunwayPlan {
  beanId: string | null;
  month: string;
  targetGrams: number;
  status: string;
}

export type RunwayState = "empty" | "order-now" | "order-soon" | "ok" | "no-pace";

export interface LotRunway {
  lot: RunwayLot;
  /** Weight loss used to convert roasted demand to green — measured if the lot has completed roasts. */
  lossPercent: number;
  lossIsMeasured: boolean;
  onHandGrams: number;
  /** Green earmarked for won leads. */
  firmGrams: number;
  /** Green earmarked for leads still open. */
  softGrams: number;
  /** On hand minus firm commitments (never below zero). */
  freeGrams: number;
  /** Free minus soft too — what's left if every open lead closes. */
  freeIfAllWonGrams: number;
  /** Green still to roast under this lot's plans this month or later. */
  plannedGrams: number;
  /** Grams per day over the last 90 days, null with no recent roasts. */
  burnPerDay: number | null;
  daysOfCover: number | null;
  stockOutDate: Date | null;
  orderByDate: Date | null;
  /** The order-by date is already today or past — order now. */
  orderByPassed: boolean;
  state: RunwayState;
}

function burnPerDay(lot: RunwayLot, now: Date): number | null {
  const cutoff = now.getTime() - BURN_WINDOW_DAYS * MS_PER_DAY;
  const recent = lot.roastSessions.filter(
    (s): s is typeof s & { startedAt: Date } => s.startedAt != null && s.startedAt.getTime() >= cutoff
  );
  if (recent.length === 0) return null;
  const burned = recent.reduce((sum, s) => sum + s.greenWeightGrams, 0);
  const oldest = Math.min(...recent.map((s) => s.startedAt.getTime()));
  const spanDays = Math.max(1, (now.getTime() - oldest) / MS_PER_DAY);
  return burned > 0 ? burned / spanDays : null;
}

export function computeRunway(
  lots: RunwayLot[],
  allocations: RunwayAllocation[],
  plans: RunwayPlan[],
  roastedByLotMonth: (beanId: string, month: string) => number,
  now = new Date()
): LotRunway[] {
  const thisMonth = now.toISOString().slice(0, 7);

  return lots.map((lot) => {
    const measured = measuredLossPercent(lot.roastSessions);
    const lossPercent = measured ?? DEFAULT_LOSS_PERCENT;

    let firmRoasted = 0;
    let softRoasted = 0;
    for (const a of allocations) {
      if (a.beanId !== lot.id) continue;
      const w = allocationWeight(a.lead.status, a.fulfilledAt);
      if (w === "firm") firmRoasted += a.roastedGrams;
      else if (w === "soft") softRoasted += a.roastedGrams;
    }
    const firmGrams = greenNeeded(firmRoasted, lossPercent);
    const softGrams = greenNeeded(softRoasted, lossPercent);

    const onHand = Math.max(0, lot.remainingGrams);
    const free = Math.max(0, onHand - firmGrams);
    const freeIfAllWon = Math.max(0, free - softGrams);

    // Plans store a *roasted* target. Green still to roast = whatever of the
    // target hasn't been roasted yet this month, converted at the lot's yield.
    const plannedGrams = plans
      .filter((p) => p.beanId === lot.id && p.month >= thisMonth && p.status !== "completed")
      .reduce((sum, p) => {
        const doneGreen = roastedByLotMonth(lot.id, p.month);
        const doneRoasted = doneGreen * (1 - lossPercent / 100);
        return sum + greenNeeded(Math.max(0, p.targetGrams - doneRoasted), lossPercent);
      }, 0);

    const burn = burnPerDay(lot, now);
    const leadTime = lot.leadTimeDays ?? DEFAULT_LEAD_TIME_DAYS;

    let daysOfCover: number | null = null;
    let stockOutDate: Date | null = null;
    let orderByDate: Date | null = null;
    let state: RunwayState;

    if (onHand <= 0) {
      state = "empty";
    } else if (burn == null) {
      state = "no-pace";
    } else {
      daysOfCover = free / burn;
      stockOutDate = new Date(now.getTime() + daysOfCover * MS_PER_DAY);
      orderByDate = new Date(stockOutDate.getTime() - leadTime * MS_PER_DAY);
      state = daysOfCover <= leadTime ? "order-now" : daysOfCover <= leadTime * 2 ? "order-soon" : "ok";
    }

    return {
      lot,
      lossPercent,
      lossIsMeasured: measured != null,
      onHandGrams: onHand,
      firmGrams,
      softGrams,
      freeGrams: free,
      freeIfAllWonGrams: freeIfAllWon,
      plannedGrams,
      burnPerDay: burn,
      daysOfCover,
      stockOutDate,
      orderByDate,
      orderByPassed: orderByDate != null && orderByDate.getTime() <= now.getTime(),
      state,
    };
  });
}

const STATE_ORDER: Record<RunwayState, number> = {
  "order-now": 0,
  empty: 1,
  "order-soon": 2,
  ok: 3,
  "no-pace": 4,
};

/** Most urgent first; ties broken by fewest days of cover. */
export function sortByUrgency(rows: LotRunway[]): LotRunway[] {
  return [...rows].sort(
    (a, b) =>
      STATE_ORDER[a.state] - STATE_ORDER[b.state] ||
      (a.daysOfCover ?? Infinity) - (b.daysOfCover ?? Infinity)
  );
}
