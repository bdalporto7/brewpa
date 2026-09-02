/**
 * The thin "how much is left" bar used for green/roasted stock, roast
 * sessions, and drop claims. `--fill-width` (not a plain width class) is
 * what the `pour-fill` keyframe in globals.css animates from 0 on mount —
 * a plain width won't replay that fill animation.
 *
 * The fill's leading edge runs through the `sketchy-fine` filter, so it
 * reads as a marker stroke laid down to that point rather than a `<progress>`
 * bar — thickened from the original 6px track since the wobble breaks a
 * thinner stroke into visible gaps instead of an imperfect edge.
 */
export default function ProgressBar({ percent, low = false }: { percent: number; low?: boolean }) {
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-accent-soft">
      <div
        className={`pour-fill h-full rounded-full ${low ? "bg-warning" : "bg-accent"}`}
        style={
          {
            // @ts-expect-error -- custom property consumed by the pour-fill keyframe
            "--fill-width": `${Math.max(0, Math.min(100, percent))}%`,
            filter: "url(#sketchy-fine)",
          }
        }
      />
    </div>
  );
}
