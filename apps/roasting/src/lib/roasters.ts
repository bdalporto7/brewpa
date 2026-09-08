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
