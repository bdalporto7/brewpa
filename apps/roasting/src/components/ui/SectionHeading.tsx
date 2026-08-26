import type { ReactNode } from "react";

/**
 * A section h2 with a hand-drawn underline accent (Cardboard Brown, not the
 * functional --accent) — part of the "Kraft & Ink" direction. Doesn't own
 * outer layout (margin, a trailing "View all →" link) so it drops into any
 * existing header wrapper.
 */
export default function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <div>
      <h2 className="font-medium">{children}</h2>
      <svg width="52" height="9" viewBox="0 0 52 9" className="mt-0.5 block">
        <path
          d="M2 5 Q9 2 16 5 T30 5 T44 5 T50 4"
          stroke="var(--brand)"
          strokeWidth="2.2"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    </div>
  );
}
