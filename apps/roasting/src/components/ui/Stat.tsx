import type { ReactNode } from "react";

/** A small "big number + label" tile — used identically across every
 * detail page's stats row (duration, weight loss, rating, etc.). */
export default function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border-2 border-[var(--border-strong)] bg-surface shadow-[2px_2px_0_var(--shadow-ink)] p-3">
      <p className="font-mono text-lg font-semibold">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}
