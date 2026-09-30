import type { ReactNode } from "react";

/**
 * Dense stat tile for the inventory dashboard — compact by design (the
 * inventory section is a working tool, not a marketing page): label on
 * top, one big mono number, optional sub-line. Contrast with the roasting
 * side's airier Stat: same tokens, tighter rhythm.
 */
export default function InvStat({
  label,
  value,
  sub,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2.5">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-0.5 font-mono text-xl font-semibold leading-tight">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}
