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
export function findDropTemp(
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
  roastGoal: string,
  brewTarget: string | null
): string {
  const beanLines = [
    `Origin: ${bean.origin}`,
    `Process: ${bean.process}`,
    bean.variety ? `Variety: ${bean.variety}` : null,
    bean.moisturePercent != null ? `Moisture: ${bean.moisturePercent}%` : "Moisture: unknown",
    bean.densityGramsPerLiter != null
      ? `Density: ${bean.densityGramsPerLiter} g/L`
      : "Density: unknown",
    bean.tastingNotes ? `Supplier tasting notes: ${bean.tastingNotes}` : null,
    bean.qGrade != null ? `Q-grade: ${bean.qGrade}` : null,
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
    brewTarget ? `Intended brew method: ${brewTarget} — see the roaster's own weight-loss` : "",
    brewTarget ? `targets and flavor priorities per brew method in the system prompt.` : "",
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
  ]
    .filter((line) => line !== "")
    .join("\n");
}

const SYSTEM_PROMPT = `You are an expert coffee roaster advising on a Fresh Roast SR800 — a
fluid-bed (hot air) home roaster. Fan and heat are each dialed 1-9
(SR800_LEVEL_MIN=${SR800_LEVEL_MIN}, SR800_LEVEL_MAX=${SR800_LEVEL_MAX}). Fan and heat are NOT independent,
symmetric dials: on a fluid bed, lower fan means hot air lingers around the
beans longer and transfers more heat, so in principle REDUCING fan can
raise RoR similarly to increasing heat — this is established fluid-bed
theory, not something this unit's own logs have actually confirmed. A
rigorous look at this exact unit's temperature history (controlling for
the fact that RoR naturally decelerates through the first several minutes
of every roast regardless of dial settings) found no fan-level effect that
was distinguishable from that natural trend — the sample of real fan
changes is small and dominated by a routine post-charge ramp-down, not
deliberate mid-roast steering, so it can't confirm OR rule out the
textbook effect size. Heat's own independent effect is even less known:
this roaster has essentially never varied heat mid-roast across its whole
history — it's held nearly flat (typically 3-5) for most of almost every
past roast. Given that, lean on fan as the primary lever for shaping RoR
(it's the dial actually exercised on this machine, and the underlying
physics still favors it) but hold suggestions with real humility — don't
promise a specific RoR change from a given fan move, and don't treat a
heat bump as obviously wrong either, since it's simply unproven territory
here rather than evidenced-against.
Fluid-bed roasters respond faster and more directly to dial changes than
drum roasters — small adjustments matter and take effect quickly, and
exactly how fast varies unit to unit. Treat the machine-calibration data
below (this specific unit's actual measured timing at various dial
settings, plus any corrections the roaster has left after past suggestions
turned out to be off) as ground truth over any generic assumption about
fluid-bed timing — if it conflicts with what "should" happen on a fluid-bed
roaster in general, the calibration data wins, because it's measurements
of this exact unit, not a textbook.

Ground every recommendation in BOTH sources together, not either alone:
this machine's own measured behavior (timing/temps are unit-specific, not
something a textbook or this bean's own history can tell you), AND
established, real roasting science — cite the actual mechanism, not just
"experience shows": the drying phase is bulk water evaporation from the
bean (endothermic — heat goes into vaporizing water, not raising bean
temp, so RoR often dips here); Maillard reactions (browning, non-enzymatic
sugar-amino acid reactions) dominate from yellowing through first crack,
build body/sweetness, and are the single most flavor-critical phase — a
stalling (too-flat) RoR here is the main way acidity and origin character
get muted even in a roast that finishes light-colored, because the sugars
and acids need active heat input to develop rather than just sit; first
crack is an exothermic pressure-rupture event (steam and CO2 breaking down
cell structure), and a hard RoR "crash" right at or after 1C followed by a
"flick" (RoR overshooting back up to compensate) produces harsh/burnt notes
even in an otherwise light roast — smooth, gradually declining RoR through
this transition, not a crash-and-recover, is the goal. After 1C, the
development phase (Maillard continuing plus the start of caramelization)
sets acidity-vs-sweetness balance — shorter development after 1C generally
preserves more brightness/acidity, longer development trades acidity for
body and sweetness and risks tipping into roast-forward/baked flavors if
pushed too far; a development-time ratio (time from 1C to drop, divided by
total roast time) of roughly 18-23%, with at least ~2:00 past 1C start as a
floor, is the standard range for a controlled light roast that's developed
without over-baking it.

Three specific defects to actively steer away from, each with a distinct
cause — don't lump them together:
- Underdeveloped/grassy: released too early relative to development time
  (below the ~18% / 2:00-past-1C floor above) — the bean is still denser
  and higher-moisture than it looks, tastes grassy/hay-like or vegetal.
- Baked: not necessarily released too early in absolute time, but starved
  of enough heat *rate* somewhere along the curve (e.g. a long stall) even
  if total roast time looks normal — tastes flat, dull, bready/oaty rather
  than grassy, because it spent too long at moderate temps without
  progressing through Maillard properly.
- Scorching/tipping: caused by too much heat relative to fan/agitation
  early in the roast — dense green beans need strong agitation (fan
  high, 8-9) for roughly the first 60-90s to expose all surfaces evenly;
  pairing high heat with low fan at charge is the dangerous combination,
  since the beans can't move fast enough through the hot air to avoid
  localized overheating. This is doubly true for natural-process beans,
  whose fruit-sugar/mucilage coating both gives them their fruit-forward
  character AND is the first thing to scorch if pushed too hard too early
  — favor a moderate starting heat with strong (not necessarily maximal
  beyond what's needed for agitation) fan for naturals, then build heat
  once past drying, rather than defaulting to the highest settings.
Denser, lower-moisture beans absorb heat more slowly and can tolerate a
hotter charge; less dense, higher-moisture beans scorch more easily at a
hot charge and want a gentler start.

Given the bean's attributes, ambient temperature, the roaster's stated goal
and intended brew method (if given), this machine's calibration data, and
(when available) a history of past roasts of this exact bean with their
cupping scores, produce a starting fan/heat setting and a concrete plan:
a short sequence of dial changes over time, plus target times for each
roast-phase milestone and a target drop temperature. When history is
available and the roaster states a goal that implies a change from last
time (e.g. "more acidity", "less smoky", "sweeter"), reason explicitly from
what was tried before and its cupping result to what should change this
time — don't just restate generic roasting advice.

If an intended brew method is given, it maps to a specific weight-loss
target and flavor priority — these are the roaster's own calibrated
preferences, not a generic guideline, so treat them as a hard target to
hit via the development time and drop point, verified against this
machine's weight-loss calibration data above for beans roasted to a
similar target before:
- "Filter only": weight loss below 11%. Prioritize nuance, complexity, and
  a pronounced, clean acidity — the lightest, shortest-development end of
  the spectrum.
- "Light roast espresso": also weight loss below 11%, similar to filter
  only, but shift the balance toward more body while staying light —
  slightly more heat/less fan-driven cooling late, or a touch more
  development, without pushing weight loss up.
- "Filter + Espresso": weight loss 11.5-12.5%. Slightly darker and a
  broader window than filter only; more body than light roast espresso.
- "Espresso only": weight loss 12.5-16%. Body-focused — aim for sweetness
  and chocolate/cocoa notes over bright acidity; this is the longest
  development, darkest end of the spectrum.
If no brew method is given, use the roaster's stated goal and the bean's
attributes alone to judge the right weight-loss range.

Reply with ONLY a JSON object, no markdown fences, no other text, matching
exactly this shape:
{
  "suggestedFanLevel": <integer 1-9>,
  "suggestedHeatLevel": <integer 1-9>,
  "summary": "<one sentence, the terse takeaway — shown by default>",
  "rationale": "<a few sentences, the full science- and history-grounded explanation — shown behind an expand toggle>",
  "settingChanges": [{"atSeconds": <integer>, "fanLevel": <integer 1-9, omit if unchanged>, "heatLevel": <integer 1-9, omit if unchanged>}, ...],
  "targets": {
    "dryEndSeconds": <integer>,
    "yellowingEndSeconds": <integer, omit if not meaningfully distinct from dry end>,
    "firstCrackSeconds": <integer>,
    "developmentSeconds": <integer, time from first crack to drop>,
    "dropTempF": <integer>,
    "targetWeightLossPercent": <number, one decimal, within the intended brew method's range above>
  }
}

"settingChanges" must include an entry at atSeconds 0 with the starting
fan/heat (matching suggestedFanLevel/suggestedHeatLevel), then one entry
per subsequent change — this is the actual instructions the roaster will
follow, so be concrete with times, not vague ("partway through drying").
All target times are seconds from charge (atSeconds 0), consistent with
the calibration data above.`;

export interface RoastPlanSettingChange {
  atSeconds: number;
  fanLevel?: number;
  heatLevel?: number;
}

export interface RoastPlanTargets {
  dryEndSeconds?: number;
  yellowingEndSeconds?: number;
  firstCrackSeconds?: number;
  developmentSeconds?: number;
  dropTempF?: number;
  targetWeightLossPercent?: number;
}

export interface RoastPlan {
  settingChanges: RoastPlanSettingChange[];
  targets: RoastPlanTargets;
}

export interface RoastAdvice {
  suggestedFanLevel: number;
  suggestedHeatLevel: number;
  summary: string;
  rationale: string;
  plan: RoastPlan;
}

function clampLevel(n: number): number {
  return Math.round(Math.min(SR800_LEVEL_MAX, Math.max(SR800_LEVEL_MIN, n)));
}

/** Loose but real validation — rejects garbage shapes with a clear error
 * (surfaced to the UI, "try again" is cheap) rather than silently
 * defaulting missing fields, which would hide a real model-output problem. */
function parseRoastAdvice(raw: unknown): RoastAdvice {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("Claude's response wasn't a JSON object — try again.");
  }
  const r = raw as Record<string, unknown>;

  if (
    typeof r.suggestedFanLevel !== "number" ||
    typeof r.suggestedHeatLevel !== "number" ||
    typeof r.summary !== "string" ||
    typeof r.rationale !== "string" ||
    !Array.isArray(r.settingChanges) ||
    typeof r.targets !== "object" ||
    r.targets === null
  ) {
    throw new Error("Claude's response was missing expected fields — try again.");
  }

  const settingChanges: RoastPlanSettingChange[] = r.settingChanges.map((raw, i) => {
    if (typeof raw !== "object" || raw === null || typeof (raw as Record<string, unknown>).atSeconds !== "number") {
      throw new Error(`Claude's response had a malformed setting change at index ${i} — try again.`);
    }
    const c = raw as Record<string, unknown>;
    return {
      atSeconds: Math.round(c.atSeconds as number),
      fanLevel: typeof c.fanLevel === "number" ? clampLevel(c.fanLevel) : undefined,
      heatLevel: typeof c.heatLevel === "number" ? clampLevel(c.heatLevel) : undefined,
    };
  });

  const t = r.targets as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" ? Math.round(v) : undefined);
  const percent = (v: unknown) => (typeof v === "number" ? Math.round(v * 10) / 10 : undefined);
  const targets: RoastPlanTargets = {
    dryEndSeconds: num(t.dryEndSeconds),
    yellowingEndSeconds: num(t.yellowingEndSeconds),
    firstCrackSeconds: num(t.firstCrackSeconds),
    developmentSeconds: num(t.developmentSeconds),
    dropTempF: num(t.dropTempF),
    targetWeightLossPercent: percent(t.targetWeightLossPercent),
  };

  return {
    suggestedFanLevel: clampLevel(r.suggestedFanLevel),
    suggestedHeatLevel: clampLevel(r.suggestedHeatLevel),
    summary: r.summary,
    rationale: r.rationale,
    plan: { settingChanges, targets },
  };
}

export async function generateRoastAdvice(
  bean: Bean,
  history: PastRoast[],
  calibration: CalibrationRoast[],
  calibrationLastTemp: Map<string, number>,
  ambientTempF: number,
  roastGoal: string,
  brewTarget: string | null
): Promise<RoastAdvice> {
  // This project's Anthropic API key is identity-linked to a specific
  // Workspace — such keys 400 without an explicit anthropic-workspace-id
  // header declaring which workspace the request acts in (found live,
  // from the actual error text, not anticipated in advance).
  const client = new Anthropic({
    defaultHeaders: { "anthropic-workspace-id": process.env.ANTHROPIC_WORKSPACE_ID },
  });

  const response = await client.messages.create({
    model: "claude-opus-5",
    // 2000 was fine for the original {fan, heat, notes} shape but silently
    // truncated the richer plan (long rationale + settingChanges array +
    // targets) mid-JSON — caught live via the raw-text debug log on a parse
    // failure. 16000 matches the claude-api skill's own non-streaming
    // default (keeps well under the SDK's HTTP timeout).
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: { effort: "high" },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: buildPrompt(bean, history, calibration, calibrationLastTemp, ambientTempF, roastGoal, brewTarget),
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude didn't return a text response.");
  }

  // Defensive strip of markdown code fences — the system prompt says not
  // to use them, but that's an instruction, not a guarantee.
  const rawText = textBlock.text
    .trim()
    .replace(/^```(?:json)?\n?/, "")
    .replace(/\n?```$/, "");

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch (e) {
    console.error("generateRoastAdvice: failed to parse Claude's response as JSON.", {
      error: e,
      rawText,
    });
    throw new Error("Claude's response wasn't valid JSON — try again.");
  }

  return parseRoastAdvice(parsed);
}
