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

export const EVENT_TYPES = [
  "FAN",
  "HEAT",
  "TEMP",
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
  FIRST_CRACK_START: "1st crack start",
  FIRST_CRACK_END: "1st crack end",
  SECOND_CRACK_START: "2nd crack start",
  SECOND_CRACK_END: "2nd crack end",
  NOTE: "Note",
  DROP: "Drop (end of roast)",
};

export const CRACK_EVENT_TYPES: EventType[] = [
  "FIRST_CRACK_START",
  "FIRST_CRACK_END",
  "SECOND_CRACK_START",
  "SECOND_CRACK_END",
];
