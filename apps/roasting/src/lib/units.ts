/**
 * Weight unit conversions for the inventory section. Everything is stored
 * in grams in the database; these helpers convert at the UI boundary so
 * every weight input can offer a g/kg/lb/oz switcher with in-place
 * conversion (the displayed number changes, the stored grams don't).
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
 * sensible precision per unit, and uses the mono font token at call sites
 * so digits don't jitter.
 */
export function formatWeight(grams: number, unit?: WeightUnit): string {
  const u: WeightUnit =
    unit ?? (grams < 1000 ? "g" : grams < 10000 ? "kg" : "lb");
  const value = fromGrams(grams, u);
  const rounded =
    u === "g"
      ? Math.round(value * 10) / 10
      : u === "kg"
        ? Math.round(value * 100) / 100
        : Math.round(value * 100) / 100;
  return `${rounded.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${u}`;
}

/** Whole-gram rounding for stock math — never show fractional grams of
 * green stock in alerts or deductions. */
export function roundGrams(grams: number): number {
  return Math.round(grams * 10) / 10;
}
