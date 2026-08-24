import type { CuppingNote } from "@prisma/client";

/**
 * The SCA/Q-grading Arabica cupping form's 10 scored categories. The real
 * protocol scores Uniformity/Clean Cup/Sweetness per-cup across 5 identical
 * cups (2 points each); that's a professional-lab setup, not a home
 * roaster tasting one cup of their own coffee, so those three are
 * simplified here to a single 0-10 score each rather than requiring 5-cup
 * tracking. The other 7 keep the real 6-10 (0.25 increments) scale.
 */
export const PRIMARY_SCORE_FIELDS = [
  "fragranceAroma",
  "flavor",
  "aftertaste",
  "acidity",
  "body",
  "balance",
  "overall",
] as const;

export const DERIVED_SCORE_FIELDS = ["uniformity", "cleanCup", "sweetness"] as const;

export const ALL_SCORE_FIELDS = [...PRIMARY_SCORE_FIELDS, ...DERIVED_SCORE_FIELDS] as const;

export type ScoreField = (typeof ALL_SCORE_FIELDS)[number];

export const SCORE_LABELS: Record<ScoreField, string> = {
  fragranceAroma: "Fragrance/Aroma",
  flavor: "Flavor",
  aftertaste: "Aftertaste",
  acidity: "Acidity",
  body: "Body",
  balance: "Balance",
  overall: "Overall",
  uniformity: "Uniformity",
  cleanCup: "Clean Cup",
  sweetness: "Sweetness",
};

/**
 * A real 100-point total only means what it claims to mean once every
 * category has a score — same "null rather than guessed" rule as
 * computeRoastPhases. Partial entries (just Overall + notes, say) are
 * completely valid and expected, they just don't get a headline total.
 */
export function computeCuppingTotal(
  note: Pick<CuppingNote, ScoreField | "defects">
): number | null {
  const values = ALL_SCORE_FIELDS.map((field) => note[field]);
  if (values.some((v) => v == null)) return null;
  const sum = values.reduce((a: number, b) => a + (b as number), 0);
  return Math.max(0, sum - (note.defects ?? 0));
}
