/**
 * Fallback About copy, used only until the team writes their own on the
 * roasting app's Shop page (Site settings, About fields). Only facts known
 * to be true are written here — nothing invented.
 */
export const ABOUT_FALLBACK = {
  intro:
    "Cybar Coffee is a tiny roaster in San Francisco. We roast a handful of coffees at a time, in small batches, and sell them by the bag.",
  blocks: [
    { kind: "heading" as const, text: "Every roast is logged" },
    {
      kind: "paragraph" as const,
      text: "We track every batch in our own roasting app: the temperature curve, when first crack hits, how long the coffee develops, and how it tastes once it has rested. It's how we keep a coffee tasting the same from one bag to the next, and how we decide when a roast is ready to sell.",
    },
    { kind: "heading" as const, text: "Small batches, roasted to order" },
    {
      kind: "paragraph" as const,
      text: "We'd rather sell out than sit on stale coffee. When a coffee isn't already on the shelf we roast it for your order, which is why some bags take a couple of days.",
    },
  ],
};
