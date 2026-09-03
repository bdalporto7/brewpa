const MAX_ROASTS_CONSIDERED = 5;
const MIN_ROASTS_FOR_ESTIMATE = 2;
/** Below this, the considered roasts are too clustered in time to measure
 * a real pace from — two roasts 25 minutes apart (a real case found while
 * verifying this against production data) would otherwise floor to "1 day"
 * and imply a wildly inflated burn rate. No pace yet beats a noisy one. */
const MIN_SPAN_DAYS_FOR_ESTIMATE = 3;

/** A bean needs reordering by this many days out — roughly a typical
 * supplier lead time — regardless of what % remains. This is the whole
 * point of a velocity-based warning over a flat percentage: a bean at 40%
 * remaining but burning fast can need a heads-up sooner than one sitting
 * at 10% that's barely touched. */
export const REORDER_WARNING_DAYS = 14;

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * How many days until this bean runs out, extrapolated from its actual
 * roasting pace — not a physics prediction, just real usage averaged over
 * however many of its last roasts we have. Deliberately conservative: with
 * fewer than two dated roasts there's no pace to measure, so this returns
 * null (shown as nothing) rather than a guess from thin data.
 */
export function estimateDaysUntilEmpty(
  remainingGrams: number,
  roastSessions: { startedAt: Date | null; greenWeightGrams: number }[]
): number | null {
  const dated = roastSessions
    .filter((s): s is { startedAt: Date; greenWeightGrams: number } => s.startedAt != null)
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
    .slice(0, MAX_ROASTS_CONSIDERED);

  if (dated.length < MIN_ROASTS_FOR_ESTIMATE) return null;

  const oldest = dated[dated.length - 1].startedAt;
  const newest = dated[0].startedAt;
  const spanDays = (newest.getTime() - oldest.getTime()) / MS_PER_DAY;
  if (spanDays < MIN_SPAN_DAYS_FOR_ESTIMATE) return null;

  const totalGrams = dated.reduce((sum, s) => sum + s.greenWeightGrams, 0);
  const ratePerDay = totalGrams / spanDays;
  if (ratePerDay <= 0) return null;

  return remainingGrams / ratePerDay;
}
