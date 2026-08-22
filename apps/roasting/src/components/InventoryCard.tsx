import Link from "next/link";
import type { ReactNode } from "react";

const MAX_ITEMS = 6;

export default function InventoryCard({
  icon,
  label,
  totalGrams,
  items,
  emptyText,
}: {
  icon: ReactNode;
  label: string;
  totalGrams: number;
  items: { key: string; label: string; grams: number; href: string }[];
  emptyText: string;
}) {
  const shown = items.slice(0, MAX_ITEMS);
  const remaining = items.length - shown.length;

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-1 flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted uppercase">
        {icon}
        {label}
      </div>
      <p className="font-mono text-2xl font-semibold">{totalGrams}g</p>

      {shown.length === 0 ? (
        <p className="mt-3 text-sm text-muted">{emptyText}</p>
      ) : (
        <ul className="mt-3 flex flex-col divide-y divide-border border-t border-border">
          {shown.map((item) => (
            <li key={item.key}>
              <Link
                href={item.href}
                className="flex items-center justify-between gap-3 py-1.5 text-sm transition hover:text-accent"
              >
                <span className="truncate">{item.label}</span>
                <span className="shrink-0 font-mono text-muted">{item.grams}g</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {remaining > 0 && <p className="mt-1.5 text-xs text-muted">+{remaining} more</p>}
    </div>
  );
}
