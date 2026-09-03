import CybarMark from "@/components/ui/CybarMark";
import { RoastedBeanIcon } from "@/components/ui/CoffeeIcons";
import { ROAST_COLOR_SWATCH } from "@/lib/roastLevelColor";

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24">
      <CybarMark className="h-9 w-auto animate-spin [animation-duration:1.4s]" alt="Loading" />
      {/* Three beans standing in for a "..." ellipsis, light to dark roast
          color left to right, bouncing in sequence via a staggered
          animation-delay — Tailwind's built-in animate-bounce, not a new
          keyframe, since the effect is already exactly this. */}
      <div className="flex items-center gap-1">
        {ROAST_COLOR_SWATCH.map((color, i) => (
          <RoastedBeanIcon
            key={color}
            className="h-2.5 w-2.5 animate-bounce"
            style={{ color, animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
