import Link from "next/link";
import type { ReactNode } from "react";
import Card from "@/components/ui/Card";
import Eyebrow from "@/components/ui/Eyebrow";
import ProgressBar from "@/components/ui/ProgressBar";

const MAX_ITEMS = 6;
const LOW_STOCK_PERCENT = 15;

/** A dashboard summary tile, not a link itself — the individual items
 * inside are the links, so the card stays non-interactive (no hover
 * lift) to avoid implying the whole tile is clickable.
 *
 * `percent` is optional per item since it's only meaningful when there's
 * a real "started with X" reference to divide by — green beans have
 * `weightGrams`, but the aggregated roasted-coffee list pools remaining
 * grams across however many separate roast batches a bean has, each with
 * its own original weight, so there's no single honest percent to show
 * there. Callers with a real reference (the dashboard's green-coffee
 * list) pass it; the roasted list doesn't, and rows without it just skip
 * the bar rather than showing a misleading one. */
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
  items: { key: string; label: string; grams: number; href: string; percent?: number }[];
  emptyText: string;
}) {
  const shown = items.slice(0, MAX_ITEMS);
  const remaining = items.length - shown.length;

  return (
    <Card interactive={false} className="p-4">
      <Eyebrow icon={icon} className="mb-1">
        {label}
      </Eyebrow>
      <p className="font-mono text-2xl font-semibold">{totalGrams}g</p>

      {shown.length === 0 ? (
        <p className="mt-3 text-sm text-muted">{emptyText}</p>
      ) : (
        <ul className="mt-3 flex flex-col divide-y divide-border border-t border-border">
          {shown.map((item) => (
            <li key={item.key} className="py-1.5">
              <Link href={item.href} className="flex items-center justify-between gap-3 text-sm transition hover:text-accent">
                <span className="truncate">{item.label}</span>
                <span className="shrink-0 font-mono text-muted">{Math.round(item.grams * 10) / 10}g</span>
              </Link>
              {item.percent != null && (
                <div className="mt-1">
                  <ProgressBar percent={item.percent} low={item.percent <= LOW_STOCK_PERCENT} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {remaining > 0 && <p className="mt-1.5 text-xs text-muted">+{remaining} more</p>}
    </Card>
  );
}
