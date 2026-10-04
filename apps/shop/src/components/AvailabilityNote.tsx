import type { Availability } from "@/lib/shop-stock";

/**
 * Plain-language stock status. `noticeDays` comes from the shop settings and
 * is passed in (not imported) so this also works inside client components.
 * `tone="label"` is for text sitting on the white bag label.
 */
export default function AvailabilityNote({
  availability,
  noticeDays,
  tone = "page",
}: {
  availability: Availability;
  noticeDays: number;
  tone?: "page" | "label";
}) {
  const copy: Record<Availability, { text: string; dot: string }> = {
    ready: { text: "Roasted and ready", dot: "bg-success" },
    roast_to_order: {
      text: noticeDays > 0 ? `Roasted to order, about ${noticeDays} ${noticeDays === 1 ? "day" : "days"}` : "Roasted to order",
      dot: "bg-warning",
    },
    sold_out: { text: "Sold out for now", dot: "bg-[#9a8b7c]" },
  };
  const c = copy[availability];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${tone === "label" ? "text-[#2b1d14]" : "text-foreground"}`}>
      <span aria-hidden className={`h-2 w-2 rounded-full ${c.dot}`} />
      {c.text}
    </span>
  );
}
