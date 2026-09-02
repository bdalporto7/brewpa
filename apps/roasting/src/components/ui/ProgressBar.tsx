/**
 * The thin "how much is left" bar used for green/roasted stock and drop
 * claims. `--fill-width` (not a plain width class) is what the `pour-fill`
 * keyframe in globals.css animates from 0 on mount — a plain width won't
 * replay that fill animation.
 */
export default function ProgressBar({ percent, low = false }: { percent: number; low?: boolean }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-accent-soft">
      <div
        className={`pour-fill h-full rounded-full ${low ? "bg-warning" : "bg-accent"}`}
        style={
          // @ts-expect-error -- custom property consumed by the pour-fill keyframe
          { "--fill-width": `${Math.max(0, Math.min(100, percent))}%` }
        }
      />
    </div>
  );
}
