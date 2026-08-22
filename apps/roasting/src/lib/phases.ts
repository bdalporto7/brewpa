import type { RoastEvent } from "@prisma/client";

/**
 * Classic three-phase roast breakdown (Scott Rao, "The Coffee Roaster's
 * Companion"): drying (charge → dry end), Maillard/browning (dry end →
 * first crack), development (first crack → drop). Percentages are of
 * `totalSeconds`. Any phase whose boundary events aren't logged comes back
 * null rather than guessed.
 */
export type RoastPhases = {
  dryingSeconds: number | null;
  maillardSeconds: number | null;
  developmentSeconds: number | null;
  dryingPercent: number | null;
  maillardPercent: number | null;
  developmentPercent: number | null;
};

export function computeRoastPhases(
  events: Pick<RoastEvent, "type" | "atSeconds">[],
  totalSeconds: number
): RoastPhases {
  const dryEnd = events.find((e) => e.type === "DRY_END")?.atSeconds ?? null;
  const firstCrack = events.find((e) => e.type === "FIRST_CRACK_START")?.atSeconds ?? null;

  const drying = dryEnd != null ? dryEnd : null;
  const maillard = dryEnd != null && firstCrack != null ? firstCrack - dryEnd : null;
  const development = firstCrack != null && totalSeconds > firstCrack ? totalSeconds - firstCrack : null;

  const pct = (s: number | null) => (s != null && totalSeconds > 0 ? (s / totalSeconds) * 100 : null);

  return {
    dryingSeconds: drying,
    maillardSeconds: maillard,
    developmentSeconds: development,
    dryingPercent: pct(drying),
    maillardPercent: pct(maillard),
    developmentPercent: pct(development),
  };
}
