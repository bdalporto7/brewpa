/** Coffee is stocked in ounces but thought of in pounds: 330 oz → "20 lb 10 oz". */
export function formatPool(oz: number): string {
  const neg = oz < 0;
  const n = Math.abs(Math.round(oz));
  const lb = Math.floor(n / 16);
  const rest = n % 16;
  const text = lb > 0 ? `${lb} lb${rest ? ` ${rest} oz` : ""}` : `${rest} oz`;
  return neg ? `short by ${text}` : text;
}

/** Pounds + ounces from two form boxes (either may be blank) → total ounces. */
export function toOunces(lb: string, oz: string): number {
  const l = lb.trim() === "" ? 0 : Number(lb);
  const o = oz.trim() === "" ? 0 : Number(oz);
  if (!Number.isFinite(l) || !Number.isFinite(o) || l < 0 || o < 0) return NaN;
  return Math.round(l * 16 + o);
}
