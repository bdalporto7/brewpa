import type { HTMLAttributes } from "react";

// Same feTurbulence technique as globals.css's body texture, its own data
// URI since Card's opaque bg-surface fully covers whatever's behind it —
// this doesn't compound with the body texture, it replaces what shows
// through. Verified at 3x zoom against several opacities before settling
// here: reads as an intentional "this is its own piece of cardboard"
// grain up close, stays essentially invisible at normal viewing size.
const CARD_GRAIN =
  "url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"120\" height=\"120\"><filter id=\"n\"><feTurbulence type=\"fractalNoise\" baseFrequency=\"0.85\" numOctaves=\"2\" stitchTiles=\"stitch\"/><feColorMatrix type=\"saturate\" values=\"0\"/></filter><rect width=\"100%25\" height=\"100%25\" filter=\"url(%23n)\" opacity=\"0.06\"/></svg>')";

/**
 * The shared bordered/shadowed surface every card-shaped box in this app
 * sits on. `interactive` defaults to true (the original behavior, for
 * clickable list-item cards like BeanCard) — pass `interactive={false}`
 * for a static info box, since the hover lift/tilt reads as "clickable"
 * and shouldn't appear on content that isn't a link.
 */
export default function Card({
  className = "",
  interactive = true,
  style,
  ...props
}: HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={`rounded-xl border-2 border-[var(--border-strong)] bg-surface shadow-[2px_2px_0_var(--shadow-ink)] ${interactive ? "transition-transform duration-200 hover:-translate-y-0.5 hover:-rotate-[0.4deg]" : ""} ${className}`}
      style={{ backgroundImage: CARD_GRAIN, ...style }}
      {...props}
    />
  );
}
