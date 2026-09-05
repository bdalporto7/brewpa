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

// For AI roast suggestions (RoastSession.brewTarget, AiSuggestionPanel) —
// deliberately just this filter-vs-espresso spectrum, not the full
// BREW_METHODS list below. Which specific device (V60 vs Chemex vs
// AeroPress) mostly affects grind/dose/water — the roast-level decision
// (development time, weight loss, how much acidity to preserve vs. how
// much body to build) depends on where on this spectrum you're aiming,
// and each option's target weight-loss range/flavor priority (the
// roaster's own preferences, not a generic guideline) is baked into
// roastAdvisor.ts's system prompt keyed off these exact labels.
export const ROAST_BREW_TARGETS = [
  "Filter only",
  "Light roast espresso",
  "Filter + Espresso",
  "Espresso only",
] as const;

export type RoastBrewTarget = (typeof ROAST_BREW_TARGETS)[number];

// Adapted from archive/coffee-journal's BREW_METHODS list.
export const BREW_METHODS = [
  "Espresso",
  "Pour Over",
  "V60",
  "Chemex",
  "Kalita",
  "AeroPress",
  "French Press",
  "Moka Pot",
  "Cold Brew",
  "Drip",
  "Siphon",
  "Other",
] as const;

export type BrewMethod = (typeof BREW_METHODS)[number];

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

/** Short labels for milestone buttons in the sticky live-roast action bar, where a full "1st crack start" doesn't fit a thumb-sized button. */
export const MILESTONE_ABBREVIATIONS: Partial<Record<EventType, string>> = {
  DRY_END: "DE",
  YELLOWING_END: "YE",
  FIRST_CRACK_START: "1C",
  FIRST_CRACK_END: "1CE",
  SECOND_CRACK_START: "2C",
  SECOND_CRACK_END: "2CE",
};

/** DropOrderItem.roastStyle's allowed values — a plain string column validated against this union, same convention as EventType/EVENT_TYPES above rather than a Prisma enum. */
export const DROP_ORDER_ROAST_STYLES = ["FILTER", "OMNI", "ESPRESSO"] as const;
export type DropOrderRoastStyle = (typeof DROP_ORDER_ROAST_STYLES)[number];

export const DROP_ORDER_ROAST_STYLE_LABELS: Record<DropOrderRoastStyle, string> = {
  FILTER: "Filter",
  OMNI: "Omni",
  ESPRESSO: "Espresso",
};

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
