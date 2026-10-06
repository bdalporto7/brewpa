/** The per-coffee detail fields the admin edits (stored as Square custom attributes, keys prefixed cybar_). */
export const DETAIL_FIELDS = [
  { key: "headline", label: "Headline", hint: "One line under the name, e.g. Juicy natural Ethiopian with blueberry and jasmine." },
  { key: "origin", label: "Origin" },
  { key: "producer", label: "Producer" },
  { key: "process", label: "Process" },
  { key: "variety", label: "Variety" },
  { key: "roast_style", label: "Roast style" },
  { key: "roasted_on", label: "Roasted on", hint: "Date as YYYY-MM-DD. Shown as the \"roasted\" stamp on the bag.", type: "date" },
  { key: "brew_notes", label: "Brew notes" },
] as const;

/** The standard bag sizes (ounces per bag) and default prices; the add-a-coffee form lets each be switched off or repriced. */
export const SIZE_PRESETS = [
  { label: "4 oz", oz: 4, cents: 1500 },
  { label: "8 oz", oz: 8, cents: 2200 },
  { label: "12 oz", oz: 12, cents: 2700 },
  { label: "2 lb", oz: 32, cents: 3200 },
  { label: "5 lb", oz: 80, cents: 6000 },
] as const;
