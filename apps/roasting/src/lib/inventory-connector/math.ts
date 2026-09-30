/**
 * Pure inventory math for the inventory app. No Prisma/Next imports:
 * everything takes plain values so it's testable without a database.
 *
 * "Derived, not stored": alerts are computed from live stock + roast
 * history on every render, never cached in a flag that could drift.
 * All weight is stored in grams; these helpers convert at the UI boundary.
 */

export const WEIGHT_UNITS = ["g", "kg", "lb", "oz"] as const;
export type WeightUnit = (typeof WEIGHT_UNITS)[number];

const GRAMS_PER_UNIT: Record<WeightUnit, number> = {
  g: 1,
  kg: 1000,
  lb: 453.59237,
  oz: 28.349523125,
};

export function toGrams(value: number, unit: WeightUnit): number {
  return value * GRAMS_PER_UNIT[unit];
}

export function fromGrams(grams: number, unit: WeightUnit): number {
  return grams / GRAMS_PER_UNIT[unit];
}

/**
 * Human-friendly weight display: picks a compact unit automatically when
 * none is given (g under 1kg, kg up to ~10kg, lb above that), rounds to a
 * sensible precision per unit. Call sites pair this with the mono font
 * token so digits don't jitter.
 */
export function formatWeight(grams: number, unit?: WeightUnit): string {
  const u: WeightUnit = unit ?? (grams < 1000 ? "g" : grams < 10000 ? "kg" : "lb");
  const value = fromGrams(grams, u);
  const rounded =
    u === "g" ? Math.round(value * 10) / 10 : Math.round(value * 100) / 100;
  return `${rounded.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${u}`;
}

/** Tenth-gram rounding for stock math. */
export function roundGrams(grams: number): number {
  return Math.round(grams * 10) / 10;
}

/** Default weight-loss assumption when a lot has no completed roasts to
 * measure from — a typical light/medium loss. Always shown as an
 * assumption in the UI wherever it's used, never silently. */
export const DEFAULT_LOSS_PERCENT = 16;

/** Green sitting unroasted longer than this gets an aging flag when the
 * lot has no explicit agingThresholdDays. */
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

interface BeanLike {
  remainingGrams: number;
  purchaseDate: Date;
  reorderLevelGrams: number | null;
  leadTimeDays: number | null;
  agingThresholdDays: number | null;
}

interface SessionLike {
  startedAt: Date | null;
  greenWeightGrams: number;
}

/**
 * All alerts for one lot: low-stock (below the lot's own reorder level),
 * reorder (velocity-based, using the lot's own lead time when set), and
 * aging (past the lot's own threshold). A lot can carry several at once.
 */
export function beanAlerts(bean: BeanLike, sessions: SessionLike[], now = new Date()): BeanAlert[] {
  const alerts: BeanAlert[] = [];
  const MS_PER_DAY = 1000 * 60 * 60 * 24;

  if (bean.remainingGrams > 0 && bean.reorderLevelGrams != null && bean.remainingGrams < bean.reorderLevelGrams) {
    alerts.push({
      kind: "low-stock",
      message: `Below your reorder level of ${roundGrams(bean.reorderLevelGrams)}g — ${roundGrams(bean.remainingGrams)}g left.`,
      orderByDate: null,
    });
  }

  const leadTimeDays = bean.leadTimeDays ?? 14;
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
  return Math.floor((now.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * FIFO order for in-stock lots: oldest purchase first, so the roast log
 * can suggest which lot to reach for. Lots with no remaining stock sort
 * last regardless of age.
 */
export function fifoOrder<T extends { purchaseDate: Date; remainingGrams: number }>(beans: T[]): T[] {
  return [...beans].sort((a, b) => {
    const aEmpty = a.remainingGrams <= 0 ? 1 : 0;
    const bEmpty = b.remainingGrams <= 0 ? 1 : 0;
    if (aEmpty !== bEmpty) return aEmpty - bEmpty;
    return a.purchaseDate.getTime() - b.purchaseDate.getTime();
  });
}

/**
 * Days until a lot runs out at the recent roast pace. Recent sessions
 * (last ~90 days) set the daily burn rate; too little history returns
 * null rather than a made-up number.
 */
export function estimateDaysUntilEmpty(remainingGrams: number, sessions: SessionLike[], now = new Date()): number | null {
  if (remainingGrams <= 0) return 0;
  const WINDOW_DAYS = 90;
  const cutoff = now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000;
  // Pending sessions have no startedAt — they haven't consumed anything yet.
  const recent = sessions.filter(
    (s): s is { startedAt: Date; greenWeightGrams: number } =>
      s.startedAt != null && s.startedAt.getTime() >= cutoff
  );
  if (recent.length === 0) return null;
  const burned = recent.reduce((sum, s) => sum + s.greenWeightGrams, 0);
  const spanDays = Math.max(
    1,
    (now.getTime() - Math.min(...recent.map((s) => s.startedAt.getTime()))) / (24 * 60 * 60 * 1000)
  );
  const perDay = burned / spanDays;
  if (perDay <= 0) return null;
  return remainingGrams / perDay;
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

interface YieldSession {
  greenWeightGrams: number;
  roastedWeightGrams: number | null;
}

/**
 * Measured weight-loss percent from a lot's completed roasts (roasts with
 * a recorded roastedWeightGrams), weighted by green input. Null when no
 * completed roast has a yield recorded — the caller falls back to
 * DEFAULT_LOSS_PERCENT and says so.
 */
export function measuredLossPercent(sessions: YieldSession[]): number | null {
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

// --- Cost per bag ----------------------------------------------------------

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
  bean: { purchasePrice: number | null; weightGrams: number },
  sessions: YieldSession[],
  bagGrams: number
): BagCost | null {
  if (bean.purchasePrice == null || bean.weightGrams <= 0) return null;
  const green = bean.purchasePrice / bean.weightGrams;
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
