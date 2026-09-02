import type { HTMLAttributes } from "react";

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
  ...props
}: HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={`rounded-xl border-2 border-[var(--border-strong)] bg-surface shadow-[2px_2px_0_var(--shadow-ink)] ${interactive ? "transition-transform duration-200 hover:-translate-y-0.5 hover:-rotate-[0.4deg]" : ""} ${className}`}
      {...props}
    />
  );
}
