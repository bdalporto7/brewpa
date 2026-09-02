import type { ReactNode } from "react";

/** The small uppercase icon+label row used above cards and stat groups
 * app-wide — a `className` passthrough covers the handful of per-site
 * margin variants (a card's own top label, a live-indicator row, etc.)
 * without needing a variant prop for each. */
export default function Eyebrow({
  icon,
  children,
  className = "",
}: {
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={`flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted uppercase ${className}`}>
      {icon}
      {children}
    </span>
  );
}
