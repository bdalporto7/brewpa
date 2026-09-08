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
 * San Franciscan (SF-6 and similar small-batch models) — a gas-fired drum
 * roaster, structurally different from the SR800's fluid bed: one gas
 * valve (the real heat lever) and an airflow damper instead of two dials,
 * and two temperature probes (bean/BT, environment/ET) instead of one.
 * Per Artisan's own device docs (artisan-scope.org/machines/sf/): "gas
 * control on machines produced after 8/2019," MODBUS RTU via a Watlow PM6
 * controller for BT/ET — no public spec gives exact dial ranges, so 0-10
 * here is a reasonable placeholder pending confirmation against a real
 * unit, same as the SR800's ranges would need adjusting for a variant that
 * genuinely dialed differently.
 */
export const SF6_CONTROLS: RoasterControl[] = [
  { key: "GAS", label: "Gas", min: 0, max: 10, defaultValue: 5, icon: "gauge", widget: "stepper" },
  { key: "DAMPER", label: "Damper", min: 0, max: 10, defaultValue: 5, icon: "wind", widget: "stepper" },
];

export const SF6_PROBES: RoasterProbe[] = [
  { key: "bean", label: "Bean (BT)" },
  { key: "environment", label: "Environment (ET)" },
];

/** Fixed presets offered when adding a roaster to a team — see src/app/(app)/roasters/page.tsx. Not a general "define any machine" builder yet; add a new entry here as each additional machine gets real support. */
export const ROASTER_PRESETS = [
  { name: "Fresh Roast SR800", controls: SR800_CONTROLS, probes: SR800_PROBES, supportsAiSuggestions: true },
  { name: "San Franciscan SF-6", controls: SF6_CONTROLS, probes: SF6_PROBES, supportsAiSuggestions: false },
] as const;
