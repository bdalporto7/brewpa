import type { Bean, RoastSession } from "@prisma/client";
import { estimateDaysUntilEmpty, REORDER_WARNING_DAYS } from "./inventoryVelocity";
import { greenCostPerGram } from "./economics";
import { roundGrams } from "./units";

/**
 * Pure inventory math for the /inventory section — alert evaluation, yield
 * math, and cost-per-bag. No Prisma/Next imports: everything takes plain
 * row shapes so it's testable without a database. "Derived, not stored":
 * alerts are computed from live stock + roast history on every render,
 * never cached in a flag that could drift.
 */

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** Default weight-loss assumption when a bean has no completed roasts to
 * measure from — a typical light/medium loss. Always shown as an
 * assumption in the UI wherever it's used, never silently. */
export const DEFAULT_LOSS_PERCENT = 16;

/** Green sitting unroasted longer than this gets an aging flag when the
 * bean has no explicit agingThresholdDays. */
export const DEFAULT_AGING_THRESHOLD_DAYS = 180;

export type BeanAlertKind = "reorder" | "low-stock" | "aging";

export interface BeanAlert {
  kind: BeanAlertKind;
  /** One-line human description, ready to render. */
  message: string;
  /** For reorder alerts: the date to order by (today + lead time buffer
   * subtracted from the projected empty date). */
  orderByDate: Date | null;
}

type BeanLike = Pick<
  Bean,
  "remainingGrams" | "purchaseDate" | "reorderLevelGrams" | "leadTimeDays" | "agingThresholdDays"
>;

type SessionLike = Pick<RoastSession, "startedAt" | "greenWeightGrams">;

/**
 * All alerts for one lot: low-stock (below the bean's own reorder level),
 * reorder (velocity-based, using the bean's own lead time when set), and
 * aging (past the bean's own threshold). A bean can carry several at once
 * — e.g. below its reorder level AND aging.
 */
export function beanAlerts(bean: BeanLike, sessions: SessionLike[], now = new Date()): BeanAlert[] {
  const alerts: BeanAlert[] = [];

  if (bean.remainingGrams > 0 && bean.reorderLevelGrams != null && bean.remainingGrams < bean.reorderLevelGrams) {
    alerts.push({
      kind: "low-stock",
      message: `Below your reorder level of ${roundGrams(bean.reorderLevelGrams)}g — ${roundGrams(bean.remainingGrams)}g left.`,
      orderByDate: null,
    });
  }

  const leadTimeDays = bean.leadTimeDays ?? REORDER_WARNING_DAYS;
  const daysLeft = estimateDaysUntilEmpty(bean.remainingGrams, sessions);
  if (daysLeft != null && daysLeft <= leadTimeDays) {
    const orderBy = new Date(now.getTime() - (leadTimeDays - Math.max(0, daysLeft)) * MS_PER_DAY);
    alerts.push({
      kind: "reorder",
      message:
        daysLeft <= 0
          ? `Roast pace says this lot is effectively empty — reorder now (${leadTimeDays}-day lead time).`
          : `Runs out in ~${Math.round(daysLeft)} days at your current pace — order by ${orderBy.toLocaleDateString("en-US", { month: "short", day: "numeric" })} (${leadTimeDays}-day lead time).`,
      orderByDate: orderBy,
    });
  }

  const ageDays = (now.getTime() - bean.purchaseDate.getTime()) / MS_PER_DAY;
  const agingThreshold = bean.agingThresholdDays ?? DEFAULT_AGING_THRESHOLD_DAYS;
  if (bean.remainingGrams > 0 && ageDays > agingThreshold) {
    alerts.push({
      kind: "aging",
      message: `Sitting unroasted for ${Math.floor(ageDays)} days — roast this one first (FIFO).`,
      orderByDate: null,
    });
  }

  return alerts;
}

/** Whole days since the lot was purchased. */
export function beanAgeDays(purchaseDate: Date, now = new Date()): number {
  return Math.floor((now.getTime() - purchaseDate.getTime()) / MS_PER_DAY);
}

/**
 * FIFO order for in-stock lots: oldest purchase first, so the roast log
 * can suggest which lot to reach for. Lots with no remaining stock sort
 * last regardless of age.
 */
export function fifoOrder<T extends Pick<Bean, "purchaseDate" | "remainingGrams">>(beans: T[]): T[] {
  return [...beans].sort((a, b) => {
    const aEmpty = a.remainingGrams <= 0 ? 1 : 0;
    const bEmpty = b.remainingGrams <= 0 ? 1 : 0;
    if (aEmpty !== bEmpty) return aEmpty - bEmpty;
    return a.purchaseDate.getTime() - b.purchaseDate.getTime();
  });
}

// --- Yield / calculator math ----------------------------------------------

/** Roasted output from green input at a given weight-loss percent. */
export function roastedYield(greenGrams: number, lossPercent: number): number {
  return greenGrams * (1 - lossPercent / 100);
}

/** Green input needed to end up with a target roasted weight. */
export function greenNeeded(roastedGrams: number, lossPercent: number): number {
  const yieldFrac = 1 - lossPercent / 100;
  if (yieldFrac <= 0) return Infinity;
  return roastedGrams / yieldFrac;
}

/**
 * Measured weight-loss percent from a bean's completed roasts (roasts with
 * a recorded roastedWeightGrams), weighted by green input. Null when no
 * completed roast has a yield recorded — the caller falls back to
 * DEFAULT_LOSS_PERCENT and says so.
 */
export function measuredLossPercent(
  sessions: Pick<RoastSession, "greenWeightGrams" | "roastedWeightGrams">[]
): number | null {
  const done = sessions.filter(
    (s): s is { greenWeightGrams: number; roastedWeightGrams: number } =>
      s.greenWeightGrams > 0 && s.roastedWeightGrams != null && s.roastedWeightGrams > 0
  );
  if (done.length === 0) return null;
  const green = done.reduce((sum, s) => sum + s.greenWeightGrams, 0);
  const roasted = done.reduce((sum, s) => sum + s.roastedWeightGrams, 0);
  if (green <= 0) return null;
  return ((green - roasted) / green) * 100;
}

// --- Cost per bag ------------------------------------------------------------

export interface BagCost {
  /** Green cost per gram, from the lot's purchase price. */
  greenCostPerGram: number;
  /** Weight-loss percent used — measured when available, default otherwise. */
  lossPercent: number;
  lossMeasured: boolean;
  /** True cost of one filled bag at this size. */
  costPerBag: number;
  /** Green grams consumed per bag. */
  greenGramsPerBag: number;
}

/**
 * True cost per bag: lot price → green cost/gram → through measured (or
 * assumed) weight loss → one bag at the given size. Null when the lot has
 * no purchase price — never treated as free.
 */
export function costPerBag(
  bean: Pick<Bean, "purchasePrice" | "weightGrams">,
  sessions: Pick<RoastSession, "greenWeightGrams" | "roastedWeightGrams">[],
  bagGrams: number
): BagCost | null {
  const green = greenCostPerGram(bean);
  if (green == null) return null;
  const measured = measuredLossPercent(sessions);
  const lossPercent = measured ?? DEFAULT_LOSS_PERCENT;
  const greenGramsPerBag = greenNeeded(bagGrams, lossPercent);
  return {
    greenCostPerGram: green,
    lossPercent,
    lossMeasured: measured != null,
    costPerBag: green * greenGramsPerBag,
    greenGramsPerBag,
  };
}
