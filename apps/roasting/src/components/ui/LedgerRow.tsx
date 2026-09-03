import type { ReactNode } from "react";
import ProgressBar from "@/components/ui/ProgressBar";

/**
 * A flat list row matching the mockups' bean-ledger shape exactly: text on
 * the left, a fixed-width gauge (bar + a small number under it) on the
 * right, both in the *same* row — not a text row with a full-width bar
 * stacked underneath, which is what made the first pass at this still too
 * tall. No border/shadow/radius of its own, just a hairline divider; the
 * wrapping list needs `divide-y divide-border border-t border-border`
 * (see Section's `layout="list"`) to draw those between rows.
 */
export default function LedgerRow({
  onClick,
  primary,
  secondary,
  trailing,
  percent,
  gaugeLabel,
  low = false,
}: {
  onClick: () => void;
  primary: ReactNode;
  secondary?: ReactNode;
  /** Small content (e.g. a rating) stacked above the gauge, right-aligned. */
  trailing?: ReactNode;
  percent?: number;
  gaugeLabel?: ReactNode;
  low?: boolean;
}) {
  return (
    <div
      className="flex items-center gap-4 py-2 transition hover:bg-accent-soft/40"
      onClick={onClick}
      style={{ cursor: "pointer" }}
    >
      <div className="min-w-0 flex-1">
        <h3 className="truncate font-medium">{primary}</h3>
        {secondary && <p className="truncate text-sm text-muted">{secondary}</p>}
      </div>
      {(trailing || percent != null) && (
        <div className="flex-none text-right">
          {trailing}
          {percent != null && (
            <div className="w-24 sm:w-32">
              <ProgressBar percent={percent} low={low} />
              {gaugeLabel && <p className="mt-1 font-mono text-[11px] text-muted">{gaugeLabel}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
