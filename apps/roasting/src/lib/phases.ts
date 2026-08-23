import type { RoastEvent } from "@prisma/client";

/**
 * Scott Rao's phase breakdown ("The Coffee Roaster's Companion"): drying
 * (charge → dry end) → yellowing (dry end → yellowing end) →
 * browning/Maillard (yellowing end → first crack) → development (first
 * crack → drop). Percentages are of `totalSeconds`.
 *
 * `yellowingSeconds` only comes back non-null when `YELLOWING_END` was
 * actually logged — that milestone is optional (added after `DRY_END`/
 * `FIRST_CRACK_START` already existed, so older roasts won't have it).
 * When it's missing, `browningSeconds` falls back to spanning the whole
 * dry-end-to-first-crack window (the old, coarser "Maillard" bucket) rather
 * than coming back null, so roasts logged before this milestone existed
 * still render a complete bar instead of losing their middle phase.
 */
export type RoastPhases = {
  dryingSeconds: number | null;
  yellowingSeconds: number | null;
  browningSeconds: number | null;
  developmentSeconds: number | null;
  dryingPercent: number | null;
  yellowingPercent: number | null;
  browningPercent: number | null;
  developmentPercent: number | null;
};

export function computeRoastPhases(
  events: Pick<RoastEvent, "type" | "atSeconds">[],
  totalSeconds: number
): RoastPhases {
  const dryEnd = events.find((e) => e.type === "DRY_END")?.atSeconds ?? null;
  const yellowEnd = events.find((e) => e.type === "YELLOWING_END")?.atSeconds ?? null;
  const firstCrack = events.find((e) => e.type === "FIRST_CRACK_START")?.atSeconds ?? null;

  const drying = dryEnd;
  const yellowing = dryEnd != null && yellowEnd != null ? yellowEnd - dryEnd : null;
  const browningStart = yellowEnd ?? dryEnd;
  const browning = browningStart != null && firstCrack != null ? firstCrack - browningStart : null;
  const development = firstCrack != null && totalSeconds > firstCrack ? totalSeconds - firstCrack : null;

  const pct = (s: number | null) => (s != null && totalSeconds > 0 ? (s / totalSeconds) * 100 : null);

  return {
    dryingSeconds: drying,
    yellowingSeconds: yellowing,
    browningSeconds: browning,
    developmentSeconds: development,
    dryingPercent: pct(drying),
    yellowingPercent: pct(yellowing),
    browningPercent: pct(browning),
    developmentPercent: pct(development),
  };
}
