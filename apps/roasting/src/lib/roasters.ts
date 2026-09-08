import { Fan, Flame, Gauge, Wind, type LucideIcon } from "lucide-react";
import type { EventType } from "@/lib/constants";

/**
 * One physical control on a roaster machine (a dial, valve, or damper) —
 * the generalization that lets the live-roast UI, event log, curve chart,
 * and CSV export work for a machine that isn't the Fresh Roast SR800 this
 * app was originally built for. `key` doubles as the RoastEvent.type this
 * control writes/reads (must be a member of EVENT_TYPES) — there's no
 * separate control-key concept, `type` already is one.
 *
 * `widget` is always "stepper" today — a gas valve or damper is something
 * people hand-log as a whole number they read/set, same interaction shape
 * as fan/heat, not a continuous slider. Add a second widget kind only once
 * a real control genuinely can't be represented as stepped-numeric (e.g. a
 * boolean toggle), which isn't true of anything supported so far.
 */
export interface RoasterControl {
  key: EventType;
  label: string;
  min: number;
  max: number;
  defaultValue: number;
  icon: "fan" | "flame" | "gauge" | "wind";
  widget: "stepper";
}

/** One temperature probe a machine reports — matches TemperatureReading.probeType. */
export interface RoasterProbe {
  key: string;
  label: string;
}

export const CONTROL_ICONS: Record<RoasterControl["icon"], LucideIcon> = {
  fan: Fan,
  flame: Flame,
  gauge: Gauge,
  wind: Wind,
};

export function parseControls(json: string): RoasterControl[] {
  return JSON.parse(json);
}

export function parseProbes(json: string): RoasterProbe[] {
  return JSON.parse(json);
}

/**
 * The one machine every existing team/roast already uses — seeded as each
 * team's `isDefault` RoasterDefinition row (see the add_roaster_definitions
 * migration, admin-actions.ts's addAllowedUser, and apps/desktop's
 * migrate.ts) so nothing changes for the SR800 case this generalization
 * has to stay byte-identical to.
 */
export const SR800_CONTROLS: RoasterControl[] = [
  { key: "FAN", label: "Fan", min: 1, max: 9, defaultValue: 5, icon: "fan", widget: "stepper" },
  { key: "HEAT", label: "Heat", min: 1, max: 9, defaultValue: 5, icon: "flame", widget: "stepper" },
];

export const SR800_PROBES: RoasterProbe[] = [{ key: "bean", label: "Bean" }];

/**
 * San Franciscan SF-6 — a gas-fired drum roaster, structurally different
 * from the SR800's fluid bed. Confirmed directly from San Franciscan's own
 * site (sanfranroaster.com), not just Artisan's docs:
 * - Controls: "a manual gas valve that handles the heat of the drum and a
 *   lever that allows for the control of airflow" (their blog, "The
 *   Rhythm of the Roaster Drum") — one gas valve (the real heat lever, no
 *   separate fan dial like the SR800) and an airflow damper lever.
 * - No drum-speed control: the SF-6's own product page never mentions
 *   drum RPM, while San Franciscan explicitly advertises "variable drum
 *   rotation speed" as a feature of their larger SF-10/SF-25 — i.e. fixed
 *   single-speed drum motor on the SF-6 specifically, so there's no third
 *   control needed for it here.
 * - Probes: "temperature probes for bean and environment temperatures...
 *   displayed on a dual-digital meter" — confirms bean/BT + environment/ET,
 *   matching Artisan's own device docs (artisan-scope.org/machines/sf/).
 * Neither source gives an exact numeric gauge range for the gas valve or
 * damper lever (a "gas pressure gauge" per the product page, likely PSI or
 * similar depending on the installed regulator) — 0-10 here is a
 * reasonable placeholder for "whatever a person reads off the gauge/lever
 * position and logs," pending confirmation against a real unit.
 */
export const SF6_CONTROLS: RoasterControl[] = [
  { key: "GAS", label: "Gas", min: 0, max: 10, defaultValue: 5, icon: "gauge", widget: "stepper" },
  { key: "DAMPER", label: "Damper", min: 0, max: 10, defaultValue: 5, icon: "wind", widget: "stepper" },
];

export const SF6_PROBES: RoasterProbe[] = [
  { key: "bean", label: "Bean (BT)" },
  { key: "environment", label: "Environment (ET)" },
];

/** Fixed presets every team gets automatically — see admin-actions.ts's addAllowedUser and apps/desktop/src-ts/migrate.ts for where this list gets seeded. Not a general "define any machine" builder; add a new entry here (plus a migration backfilling it onto existing teams) as each additional machine gets real support. */
export const ROASTER_PRESETS = [
  { name: "Fresh Roast SR800", controls: SR800_CONTROLS, probes: SR800_PROBES, supportsAiSuggestions: true },
  { name: "San Franciscan SF-6", controls: SF6_CONTROLS, probes: SF6_PROBES, supportsAiSuggestions: false },
] as const;
