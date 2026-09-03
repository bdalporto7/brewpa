/** The `` `$${x.toFixed(2)}` `` pattern already duplicated ad hoc across
 * BeanMeta, SalesPanel, and the friends/drops pages — a single home for it
 * now that the economics work adds several more call sites. */
export function formatCurrency(value: number): string {
  return `$${value.toFixed(2)}`;
}

export function formatMMSS(totalSeconds: number): string {
  const clamped = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(clamped / 60);
  const s = clamped % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Parses "m:ss" or "h:mm:ss" into elapsed seconds. Returns null if invalid. */
export function parseMMSS(input: string): number | null {
  const parts = input.trim().split(":");
  if (parts.length < 2 || parts.length > 3) return null;
  const nums = parts.map(Number);
  if (nums.some((n) => Number.isNaN(n) || n < 0)) return null;

  const [h, m, s] = parts.length === 3 ? nums : [0, nums[0], nums[1]];
  return h * 3600 + m * 60 + s;
}
