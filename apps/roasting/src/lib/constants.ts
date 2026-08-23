export const ROAST_LEVELS = [
  "Light",
  "Medium-Light",
  "Medium",
  "Medium-Dark",
  "Dark",
  "French",
] as const;

export type RoastLevel = (typeof ROAST_LEVELS)[number];

export const PROCESSES = [
  "Washed",
  "Natural",
  "Honey",
  "Anaerobic",
  "Wet-Hulled",
  "Other",
] as const;

export type Process = (typeof PROCESSES)[number];

// The SR800 dials run roughly 1 (low) to 9 (high) for both fan and heat.
export const SR800_LEVEL_MIN = 1;
export const SR800_LEVEL_MAX = 9;

// Milestone boundaries follow Scott Rao's phase breakdown: Drying (charge ->
// DRY_END) -> Yellowing (DRY_END -> YELLOWING_END) -> Browning/Maillard
// (YELLOWING_END -> FIRST_CRACK_START) -> Development (FIRST_CRACK_START ->
// drop). Browning's end and Development's start are the same instant as
// FIRST_CRACK_START by definition, so there's no separate "browning end"
// marker — logging first crack start already marks it. See computeRoastPhases
// in lib/phases.ts for how these turn into the phase breakdown.
export const EVENT_TYPES = [
  "FAN",
  "HEAT",
  "TEMP",
  "DRY_END",
  "YELLOWING_END",
  "FIRST_CRACK_START",
  "FIRST_CRACK_END",
  "SECOND_CRACK_START",
  "SECOND_CRACK_END",
  "NOTE",
  "DROP",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_LABELS: Record<EventType, string> = {
  FAN: "Fan level",
  HEAT: "Heat level",
  TEMP: "Temp reading",
  DRY_END: "Dry end",
  YELLOWING_END: "Yellowing end",
  FIRST_CRACK_START: "1st crack start",
  FIRST_CRACK_END: "1st crack end",
  SECOND_CRACK_START: "2nd crack start",
  SECOND_CRACK_END: "2nd crack end",
  NOTE: "Note",
  DROP: "Drop (end of roast)",
};

/** One-time-per-roast milestone markers — used to grey out an already-logged button. */
export const MILESTONE_EVENT_TYPES: EventType[] = [
  "DRY_END",
  "YELLOWING_END",
  "FIRST_CRACK_START",
  "FIRST_CRACK_END",
  "SECOND_CRACK_START",
  "SECOND_CRACK_END",
];

/** Shared by the live event timeline and the static published page. */
export function describeEvent(event: {
  type: string;
  fanLevel: number | null;
  heatLevel: number | null;
  tempFahrenheit: number | null;
  note: string | null;
}): string {
  const type = event.type as EventType;
  switch (type) {
    case "FAN":
      return `Fan → ${event.fanLevel}`;
    case "HEAT":
      return `Heat → ${event.heatLevel}`;
    case "TEMP":
      return `${event.tempFahrenheit}°F`;
    case "NOTE":
      return event.note ?? "";
    default:
      return EVENT_LABELS[type];
  }
}
