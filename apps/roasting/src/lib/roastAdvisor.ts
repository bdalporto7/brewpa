import Anthropic from "@anthropic-ai/sdk";
import type { Bean, CuppingNote, RoastEvent, RoastSession, TemperatureReading } from "@prisma/client";
import { SR800_LEVEL_MIN, SR800_LEVEL_MAX } from "@/lib/constants";
import { computeRoastPhases } from "@/lib/phases";
import { ALL_SCORE_FIELDS, SCORE_LABELS, computeCuppingTotal } from "@/lib/cupping";
import { formatMMSS } from "@/lib/format";

type PastRoast = RoastSession & { events: RoastEvent[]; cuppingNotes: CuppingNote[] };

// Only FAN/HEAT-at-charge and the two milestones actually used below — not
// every event a roast logged (fan/heat adjustments alone can be 10+ rows
// per roast). Deliberately a narrow shape (not `RoastSession & {...}`) —
// the query in actions.ts uses `select`, not `include`, to fetch exactly
// this across 40+ roasts instead of every column and every event/reading.
type CalibrationEvent = Pick<RoastEvent, "type" | "atSeconds" | "fanLevel" | "heatLevel">;
type CalibrationRoast = Pick<
  RoastSession,
  "id" | "startedAt" | "endedAt" | "ambientTempF" | "roastedWeightGrams" | "greenWeightGrams" | "aiSuggestionFeedback"
> & {
  events: CalibrationEvent[];
  temperatureReadings: Pick<TemperatureReading, "tempFahrenheit">[];
  bean: Pick<Bean, "process">;
};

/**
 * Drop temp, preferring real probe data (fetched as just the single last
 * reading per roast, not the full feed) over hand-logged TEMP — a roaster
 * typically logs those every 30-60s by eye, not exactly at drop. `lastTemp`
 * is a pre-computed roastSessionId -> last-hand-logged-°F map (see
 * buildCalibrationContext) rather than fetched per-roast here, since
 * pulling every TEMP event just to find the last one is the same
 * over-fetching problem the events/temperatureReadings trims above solve.
 */
function findDropTemp(
  roast: CalibrationRoast,
  lastTemp: Map<string, number>
): { tempF: number; fromProbe: boolean } | null {
  const lastProbeReading = roast.temperatureReadings.at(0);
  if (lastProbeReading) return { tempF: lastProbeReading.tempFahrenheit, fromProbe: true };

  const handLogged = lastTemp.get(roast.id);
  return handLogged != null ? { tempF: handLogged, fromProbe: false } : null;
}

/**
 * Compact one-line-per-roast summary of how this exact SR800 unit actually
 * behaves at various dial settings — across ALL beans, not just the one
 * being suggested for. Flavor-outcome history (summarizePastRoast) is
 * correctly scoped to one bean, but timing/thermal behavior is a property
 * of the *machine*, not the bean — without this, the model has nothing to
 * ground fan/heat-to-timing predictions in beyond generic fluid-bed
 * assumptions, which is exactly what produced a first-crack estimate wildly
 * faster than this machine actually runs on a real test (fan 8/heat 8 was
 * predicted at 6:30-8:00; real SR800 behavior at that setting is more like
 * 4-6 minutes total). Found by the roaster actually catching bad advice,
 * not anticipated in advance.
 */
function summarizeMachineCalibration(
  roasts: CalibrationRoast[],
  lastTemp: Map<string, number>
): string {
  if (roasts.length === 0) return "No completed roasts on record yet to calibrate against.";

  return roasts
    .map((roast) => {
      const duration =
        roast.startedAt && roast.endedAt
          ? (roast.endedAt.getTime() - roast.startedAt.getTime()) / 1000
          : null;
      const startFan = roast.events.find((e) => e.type === "FAN" && e.atSeconds === 0)?.fanLevel;
      const startHeat = roast.events.find((e) => e.type === "HEAT" && e.atSeconds === 0)?.heatLevel;
      const dryEnd = roast.events.find((e) => e.type === "DRY_END")?.atSeconds;
      const firstCrack = roast.events.find((e) => e.type === "FIRST_CRACK_START")?.atSeconds;

      const parts = [`${roast.bean.process}`];
      if (startFan != null || startHeat != null) {
        parts.push(`start fan ${startFan ?? "?"}/heat ${startHeat ?? "?"}`);
      }
      if (dryEnd != null) parts.push(`dry end ${formatMMSS(dryEnd)}`);
      if (firstCrack != null) parts.push(`1C ${formatMMSS(firstCrack)}`);
      if (duration != null) parts.push(`total ${formatMMSS(duration)}`);
      if (roast.ambientTempF != null) parts.push(`ambient ${roast.ambientTempF}°F`);

      const dropTemp = findDropTemp(roast, lastTemp);
      if (dropTemp) {
        parts.push(`drop temp ~${Math.round(dropTemp.tempF)}°F${dropTemp.fromProbe ? "" : " (hand-logged, approximate)"}`);
      }
      if (roast.roastedWeightGrams != null && roast.greenWeightGrams > 0) {
        const weightLoss = (1 - roast.roastedWeightGrams / roast.greenWeightGrams) * 100;
        parts.push(`${weightLoss.toFixed(1)}% weight loss`);
      }
      if (roast.aiSuggestionFeedback) {
        parts.push(`roaster's feedback on the suggestion used: "${roast.aiSuggestionFeedback}"`);
      }

      return `- ${parts.join(", ")}`;
    })
    .join("\n");
}

/**
 * Reduces each past roast of this bean into a compact plain-text summary —
 * roast params + cupping scores — never the raw rows. This is the whole
 * "reinforcement loop": the model sees what was tried and how it tasted,
 * not just the bean's static attributes.
 */
function summarizePastRoast(roast: PastRoast): string {
  const duration =
    roast.startedAt && roast.endedAt
      ? (roast.endedAt.getTime() - roast.startedAt.getTime()) / 1000
      : null;
  const phases = duration != null ? computeRoastPhases(roast.events, duration) : null;

  const lines: string[] = [];
  lines.push(
    `- ${roast.startedAt?.toISOString().slice(0, 10) ?? "undated"}, ${roast.roastLevel ?? "level unrecorded"}` +
      (duration != null ? `, ${formatMMSS(duration)} total` : "")
  );
  if (phases?.dryingSeconds != null) {
    lines.push(`  dry end at ${formatMMSS(phases.dryingSeconds)}`);
  }
  if (phases?.developmentSeconds != null) {
    lines.push(`  development time ${formatMMSS(phases.developmentSeconds)}`);
  }
  if (roast.ambientTempF != null) lines.push(`  ambient was ${roast.ambientTempF}°F`);
  if (roast.roastGoal) lines.push(`  goal at the time: "${roast.roastGoal}"`);
  if (roast.rating != null) lines.push(`  overall rating: ${roast.rating}/5`);

  for (const note of roast.cuppingNotes) {
    const total = computeCuppingTotal(note);
    const scores = ALL_SCORE_FIELDS.filter((f) => note[f] != null)
      .map((f) => `${SCORE_LABELS[f]} ${note[f]}`)
      .join(", ");
    lines.push(
      `  cupped ${note.cuppedAt.toISOString().slice(0, 10)}${total != null ? ` (total ${total}/100)` : ""}: ${scores || "no scores recorded"}`
    );
    if (note.notes) lines.push(`    tasting notes: "${note.notes}"`);
  }

  return lines.join("\n");
}

function buildPrompt(
  bean: Bean,
  history: PastRoast[],
  calibration: CalibrationRoast[],
  calibrationLastTemp: Map<string, number>,
  ambientTempF: number,
  roastGoal: string
): string {
  const beanLines = [
    `Origin: ${bean.origin}`,
    `Process: ${bean.process}`,
    bean.variety ? `Variety: ${bean.variety}` : null,
    bean.moisturePercent != null ? `Moisture: ${bean.moisturePercent}%` : "Moisture: unknown",
    bean.densityGramsPerLiter != null
      ? `Density: ${bean.densityGramsPerLiter} g/L`
      : "Density: unknown",
  ].filter(Boolean);

  const historyText =
    history.length > 0
      ? history.map(summarizePastRoast).join("\n")
      : "No prior roasts of this bean on record — this is its first time on the roaster.";

  return [
    `Bean:`,
    ...beanLines,
    ``,
    `Today's ambient temperature: ${ambientTempF}°F`,
    `Roaster's goal for this roast: ${roastGoal}`,
    ``,
    `This exact SR800 unit's actual measured behavior across past roasts of`,
    `OTHER beans (process, dial settings, and real observed timing — use this`,
    `to calibrate what fan/heat actually produces on THIS machine, since that`,
    `varies by unit and is not something to assume from generic fluid-bed`,
    `roasting knowledge):`,
    summarizeMachineCalibration(calibration, calibrationLastTemp),
    ``,
    `Past roasts of this same bean specifically, most recent first (for`,
    `flavor-outcome correlation via cupping scores):`,
    historyText,
  ].join("\n");
}

const SYSTEM_PROMPT = `You are an expert coffee roaster advising on a Fresh Roast SR800 — a
fluid-bed (hot air) home roaster. Fan and heat are each dialed 1-9
(SR800_LEVEL_MIN=${SR800_LEVEL_MIN}, SR800_LEVEL_MAX=${SR800_LEVEL_MAX}); higher fan increases airflow/convective
cooling and bean agitation, higher heat increases element temperature.
Fluid-bed roasters respond faster and more directly to dial changes than
drum roasters — small adjustments matter and take effect quickly, and
exactly how fast varies unit to unit. Treat the machine-calibration data
below (this specific unit's actual measured timing at various dial
settings, plus any corrections the roaster has left after past suggestions
turned out to be off) as ground truth over any generic assumption about
fluid-bed timing — if it conflicts with what "should" happen on a fluid-bed
roaster in general, the calibration data wins, because it's measurements
of this exact unit, not a textbook.

Established roasting science to apply, not just recite: natural-process
beans carry more fruit sugar/mucilage on the parchment than washed beans
and scorch or taste ashy/smoky if pushed too hard on heat before enough
moisture and chaff have cleared — favor a more moderate starting heat with
adequate (not necessarily maximal) fan for naturals early on, then build
heat once past the drying phase, rather than defaulting to the highest
settings just because more airflow generally helps with chaff. Also apply
real bean-density/moisture reasoning: denser, lower-moisture beans absorb
heat more slowly and can tolerate a hotter charge; less dense, higher-
moisture beans scorch more easily at a hot charge and want a gentler start.

Given the bean's attributes, ambient temperature, the roaster's stated goal,
this machine's calibration data, and (when available) a history of past
roasts of this exact bean with their cupping scores, recommend a starting
fan/heat setting and a short profile (when and how to adjust from there).
When history is available and the roaster states a goal that implies a
change from last time (e.g. "more acidity", "less smoky", "sweeter"),
reason explicitly from what was tried before and its cupping result to what
should change this time — don't just restate generic roasting advice.

Reply with ONLY a JSON object, no markdown fences, no other text, matching
exactly this shape:
{"suggestedFanLevel": <integer 1-9>, "suggestedHeatLevel": <integer 1-9>, "notes": "<string>"}

"notes" should be a few sentences: the starting point, how to adjust over
the course of the roast, and — when history was used — a brief rationale
tying the recommendation back to the past result or to this machine's
calibration data.`;

export async function generateRoastAdvice(
  bean: Bean,
  history: PastRoast[],
  calibration: CalibrationRoast[],
  calibrationLastTemp: Map<string, number>,
  ambientTempF: number,
  roastGoal: string
): Promise<{ suggestedFanLevel: number; suggestedHeatLevel: number; notes: string }> {
  // This project's Anthropic API key is identity-linked to a specific
  // Workspace — such keys 400 without an explicit anthropic-workspace-id
  // header declaring which workspace the request acts in (found live,
  // from the actual error text, not anticipated in advance).
  const client = new Anthropic({
    defaultHeaders: { "anthropic-workspace-id": process.env.ANTHROPIC_WORKSPACE_ID },
  });

  const response = await client.messages.create({
    model: "claude-opus-5",
    max_tokens: 2000,
    thinking: { type: "adaptive" },
    output_config: { effort: "high" },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: buildPrompt(bean, history, calibration, calibrationLastTemp, ambientTempF, roastGoal),
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude didn't return a text response.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(textBlock.text.trim());
  } catch {
    throw new Error("Claude's response wasn't valid JSON — try again.");
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("suggestedFanLevel" in parsed) ||
    !("suggestedHeatLevel" in parsed) ||
    !("notes" in parsed)
  ) {
    throw new Error("Claude's response was missing expected fields — try again.");
  }

  const { suggestedFanLevel, suggestedHeatLevel, notes } = parsed as Record<string, unknown>;
  if (
    typeof suggestedFanLevel !== "number" ||
    typeof suggestedHeatLevel !== "number" ||
    typeof notes !== "string"
  ) {
    throw new Error("Claude's response had the wrong field types — try again.");
  }

  return {
    suggestedFanLevel: Math.round(
      Math.min(SR800_LEVEL_MAX, Math.max(SR800_LEVEL_MIN, suggestedFanLevel))
    ),
    suggestedHeatLevel: Math.round(
      Math.min(SR800_LEVEL_MAX, Math.max(SR800_LEVEL_MIN, suggestedHeatLevel))
    ),
    notes,
  };
}
