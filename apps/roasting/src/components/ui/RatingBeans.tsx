import { RoastedBeanIcon } from "@/components/ui/CoffeeIcons";

/**
 * A roast rating shown as roasted-bean icons instead of "★"/"☆" characters.
 * With `max`, renders faded beans for the unfilled remainder (out of 5);
 * without it, renders exactly `rating` filled beans and nothing else —
 * matching whichever of the two star-rating conventions was already in use
 * at each call site.
 */
export default function RatingBeans({
  rating,
  max,
  className = "",
}: {
  rating: number;
  max?: number;
  className?: string;
}) {
  const total = max ?? rating;
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`}>
      {Array.from({ length: total }, (_, i) => (
        <RoastedBeanIcon key={i} className={`h-3.5 w-3.5 ${i < rating ? "" : "opacity-25"}`} />
      ))}
    </span>
  );
}
