import type { RoastLevel } from "@/lib/constants";

/**
 * A fun, approximate weight-loss-%-to-roast-level-and-color guess — not a
 * precise instrument reading. Real weight loss at a given roast level
 * varies by bean density, moisture content, and process, so these bands
 * (loosely matching ranges cited by home-roasting references like Sweet
 * Maria's) and the colors are a ballpark visual estimate, not a substitute
 * for actually looking at/tasting the roast. Reuses this app's own
 * ROAST_LEVELS naming (constants.ts) rather than a separate scheme like
 * City/Full City, so it lines up with the roastLevel field elsewhere.
 */
const BANDS: { max: number; level: RoastLevel; color: string }[] = [
  { max: 13, level: "Light", color: "#c89b6a" },
  { max: 14, level: "Medium-Light", color: "#b98552" },
  { max: 15.5, level: "Medium", color: "#8b5e3c" },
  { max: 17, level: "Medium-Dark", color: "#6b4226" },
  { max: 19, level: "Dark", color: "#4a2e1d" },
  { max: Infinity, level: "French", color: "#2a1810" },
];

export function estimateRoastLevel(weightLossPercent: number): { level: RoastLevel; color: string } {
  const band = BANDS.find((b) => weightLossPercent < b.max) ?? BANDS[BANDS.length - 1];
  return { level: band.level, color: band.color };
}
