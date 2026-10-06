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
