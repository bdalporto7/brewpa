/**
 * Parses Artisan (artisan-roaster-scope/artisan) roast logs — .alog files,
 * or the JSON export from Artisan's File > Export > JSON — into a plain,
 * DB-agnostic result this app's importArtisanRoast Server Action (in
 * actions.ts) can write directly. Pure, no Prisma/Next imports, so it's
 * exercisable against a real downloaded .alog fixture with no server or
 * database involved — same separation as mastechFrameParser.ts/modbusRtu.ts
 * vs. their DB-touching counterparts.
 *
 * Field semantics and the timeindex milestone-slot mapping below are
 * confirmed directly from Artisan's own open-source code
 * (artisan-roaster-scope/artisan, src/artisanlib/util.py), not guessed —
 * see this module's own comments for the exact source lines.
 */

import type { RoasterControl } from "@/lib/roasters";

export interface ArtisanProfile {
  mode: "C" | "F";
  timex: number[];
  temp1: number[]; // ET
  temp2: number[]; // BT
  timeindex: number[];
  specialevents: number[];
  specialeventstype: number[];
  specialeventsvalue: number[];
  specialeventsStrings: string[];
  etypes: string[];
  weight: [number, number, string];
  beans: string;
  title: string;
  roastepoch?: number;
  roastisodate?: string;
  roasttime?: string;
  roastertype?: string;
}

export interface ArtisanImportEvent {
  type: string;
  atSeconds: number;
  controlValue?: number;
  note?: string;
}

export interface ArtisanImportResult {
  startedAt: Date;
  endedAt: Date;
  greenWeightGrams: number;
  roastedWeightGrams: number;
  events: ArtisanImportEvent[];
  temperatureReadings: { probeType: "bean" | "environment"; atSeconds: number; tempFahrenheit: number }[];
  beanNameGuess: { name: string; origin: string | null };
}

const isIdentChar = (c: string | undefined): boolean => !!c && /[A-Za-z0-9_]/.test(c);

/**
 * Converts a Python dict-literal string (what Artisan actually writes to
 * .alog files — single/double-quoted strings per Python's own repr()
 * rules, `None`, capitalized `True`/`False`) into valid JSON text.
 *
 * A blind regex replace for None/True/False would also mangle those words
 * if they legitimately appear inside a string value (e.g. roasting notes
 * that happen to contain "None" or "True"), so this walks the text
 * character by character, tracking whether it's inside a quoted string —
 * only bare None/True/False tokens *outside* any string get replaced.
 * String delimiters are normalized to `"` either way, since Python's
 * repr() picks `'` normally but switches to `"` when the string itself
 * contains an apostrophe (e.g. bean names like "Farmer's Choice") — both
 * need handling, not just `'`.
 */
export function pythonLiteralToJson(text: string): string {
  let out = "";
  let i = 0;
  const n = text.length;

  while (i < n) {
    const ch = text[i];

    if (ch === "'" || ch === '"') {
      const quote = ch;
      out += '"';
      i++;
      while (i < n) {
        const c = text[i];
        if (c === "\\" && i + 1 < n) {
          const next = text[i + 1];
          if (next === quote) {
            // An escaped delimiter in the source is just a literal
            // character — only re-escape it in the output if it's a
            // double quote (JSON needs `\"`; a literal `'` needs nothing).
            out += next === '"' ? '\\"' : next;
          } else if (next === "\\") {
            out += "\\\\";
          } else {
            out += "\\" + next;
          }
          i += 2;
          continue;
        }
        if (c === quote) {
          i++;
          break;
        }
        if (c === '"') {
          // A raw double quote inside a single-quoted Python string —
          // needs escaping for the JSON output either way.
          out += '\\"';
          i++;
          continue;
        }
        out += c;
        i++;
      }
      out += '"';
      continue;
    }

    if (text.startsWith("None", i) && !isIdentChar(text[i - 1]) && !isIdentChar(text[i + 4])) {
      out += "null";
      i += 4;
      continue;
    }
    if (text.startsWith("True", i) && !isIdentChar(text[i - 1]) && !isIdentChar(text[i + 4])) {
      out += "true";
      i += 4;
      continue;
    }
    if (text.startsWith("False", i) && !isIdentChar(text[i - 1]) && !isIdentChar(text[i + 5])) {
      out += "false";
      i += 5;
      continue;
    }

    out += ch;
    i++;
  }

  return out;
}

export function parseArtisanFile(text: string): ArtisanProfile {
  try {
    return JSON.parse(text) as ArtisanProfile;
  } catch {
    // Not valid JSON — assume it's a raw .alog Python dict literal.
  }
  try {
    return JSON.parse(pythonLiteralToJson(text)) as ArtisanProfile;
  } catch {
    throw new Error("Couldn't parse this file as an Artisan .alog or .json export.");
  }
}

export function toFahrenheit(value: number, mode: "C" | "F"): number {
  return mode === "C" ? (value * 9) / 5 + 32 : value;
}

export function toGrams(value: number, unit: string): number {
  switch (unit) {
    case "g":
      return value;
    case "kg":
      return value * 1000;
    case "oz":
      return value * 28.3495;
    default:
      throw new Error(`Unrecognized weight unit "${unit}" in Artisan file.`);
  }
}

export function guessBeanFromLabel(beans: string, title: string): { name: string; origin: string | null } {
  const label = beans.trim() || title.trim();
  if (!label) return { name: "Imported bean", origin: null };
  const commaIndex = label.indexOf(",");
  if (commaIndex === -1) return { name: label, origin: null };
  return { name: label.slice(0, commaIndex).trim(), origin: label.slice(commaIndex + 1).trim() || null };
}

/**
 * Milestone timeindex slots, confirmed from Artisan's own
 * src/artisanlib/util.py (~lines 1510-1519):
 *   [0]=CHARGE (this app's t=0), [1]=DRY end, [2]=FCs, [3]=FCe, [4]=SCs,
 *   [5]=SCe, [6]=DROP, [7]=COOL end (no equivalent in this app, ignored).
 * A falsy index (0) means that milestone was never marked in Artisan —
 * Artisan's own code skips it the same way (`if timeindex[i]`).
 */
const MILESTONE_SLOTS: { index: number; type: string }[] = [
  { index: 1, type: "DRY_END" },
  { index: 2, type: "FIRST_CRACK_START" },
  { index: 3, type: "FIRST_CRACK_END" },
  { index: 4, type: "SECOND_CRACK_START" },
  { index: 5, type: "SECOND_CRACK_END" },
  { index: 6, type: "DROP" },
];

export function buildArtisanImportResult(profile: ArtisanProfile, controls: RoasterControl[]): ArtisanImportResult {
  const chargeIdx = profile.timeindex[0];
  if (chargeIdx == null || chargeIdx < 0 || chargeIdx >= profile.timex.length) {
    throw new Error("This Artisan file has no CHARGE point recorded — nothing to import.");
  }
  const t0 = profile.timex[chargeIdx];
  const relSeconds = (timexIndex: number) => Math.round(profile.timex[timexIndex] - t0);

  let startedAt: Date;
  if (profile.roastepoch) {
    startedAt = new Date(profile.roastepoch * 1000);
  } else if (profile.roastisodate && profile.roasttime) {
    startedAt = new Date(`${profile.roastisodate}T${profile.roasttime}`);
  } else {
    throw new Error("This Artisan file has no roast date/time recorded.");
  }
  if (Number.isNaN(startedAt.getTime())) {
    throw new Error("This Artisan file's roast date/time couldn't be parsed.");
  }

  const dropIdx = profile.timeindex[6];
  const durationSeconds =
    dropIdx ? relSeconds(dropIdx) : Math.round(profile.timex[profile.timex.length - 1] - t0);
  const endedAt = new Date(startedAt.getTime() + durationSeconds * 1000);

  const events: ArtisanImportEvent[] = [];

  for (const { index, type } of MILESTONE_SLOTS) {
    const idx = profile.timeindex[index];
    if (!idx) continue;
    events.push({ type, atSeconds: relSeconds(idx) });
  }

  const controlsByLabel = new Map(controls.map((c) => [c.label.toLowerCase(), c]));
  for (let i = 0; i < profile.specialevents.length; i++) {
    const timexIndex = profile.specialevents[i];
    const label = profile.etypes[profile.specialeventstype[i]] ?? "";
    const value = profile.specialeventsvalue[i];
    const atSeconds = relSeconds(timexIndex);
    const control = controlsByLabel.get(label.toLowerCase());
    if (control) {
      events.push({ type: control.key, atSeconds, controlValue: value });
    } else {
      events.push({ type: "NOTE", atSeconds, note: `${label}: ${value} (imported from Artisan)` });
    }
  }

  const temperatureReadings: ArtisanImportResult["temperatureReadings"] = [];
  for (let i = 0; i < profile.timex.length; i++) {
    const atSeconds = relSeconds(i);
    if (typeof profile.temp2[i] === "number" && Number.isFinite(profile.temp2[i])) {
      temperatureReadings.push({ probeType: "bean", atSeconds, tempFahrenheit: toFahrenheit(profile.temp2[i], profile.mode) });
    }
    if (typeof profile.temp1[i] === "number" && Number.isFinite(profile.temp1[i])) {
      temperatureReadings.push({
        probeType: "environment",
        atSeconds,
        tempFahrenheit: toFahrenheit(profile.temp1[i], profile.mode),
      });
    }
  }

  return {
    startedAt,
    endedAt,
    greenWeightGrams: toGrams(profile.weight[0], profile.weight[2]),
    roastedWeightGrams: toGrams(profile.weight[1], profile.weight[2]),
    events,
    temperatureReadings,
    beanNameGuess: guessBeanFromLabel(profile.beans, profile.title),
  };
}
