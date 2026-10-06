"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Pencil } from "lucide-react";
import { createShopListing, moveListing, setListingListed } from "@/lib/shop-actions";
import { formatCents, type Availability } from "@/lib/shop-stock";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

export interface ManagerRow {
  beanId: string;
  name: string;
  origin: string;
  process: string;
  roastedGrams: number;
  roastableGrams: number;
  listing: {
    id: string;
    slug: string;
    isListed: boolean;
    sortOrder: number;
    createdAt: number;
    sizes: { label: string; priceCents: number; availability: Availability }[];
  } | null;
}

const DOT: Record<Availability, string> = {
  ready: "bg-success",
  roast_to_order: "bg-warning",
  backorder: "bg-warning",
  sold_out: "bg-border",
};

export default function ShopManagerList({ onShop, notOnShop }: { onShop: ManagerRow[]; notOnShop: ManagerRow[] }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  function run(fn: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  const withStock = notOnShop.filter((r) => r.roastedGrams + r.roastableGrams > 0);
  const extra = notOnShop.length - withStock.length;
  const candidates = showAll ? notOnShop : withStock;

  return (
    <div className="flex flex-col gap-6">
      {error && <p className="text-sm text-danger">{error}</p>}

      {onShop.length === 0 ? (
        <p className="text-sm text-muted">No coffees on the shop yet. Add one from the list below.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {onShop.map((row, i) => {
            const l = row.listing!;
            return (
              <li key={row.beanId}>
                <Card interactive={false} className={`flex flex-wrap items-center gap-3 p-3 ${l.isListed ? "" : "opacity-70"}`}>
                  <div className="flex flex-col">
                    <button
                      type="button"
                      aria-label={`Move ${row.name} up`}
                      disabled={isPending || i === 0}
                      onClick={() => run(() => moveListing(l.id, "up"))}
                      className="rounded p-0.5 text-muted hover:text-foreground disabled:opacity-30"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${row.name} down`}
                      disabled={isPending || i === onShop.length - 1}
                      onClick={() => run(() => moveListing(l.id, "down"))}
                      className="rounded p-0.5 text-muted hover:text-foreground disabled:opacity-30"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{row.name}</p>
                    <p className="text-xs text-muted">
                      {row.origin}, {row.process.toLowerCase()} · <span className="font-mono">{row.roastedGrams}g</span> roasted,{" "}
                      <span className="font-mono">{row.roastableGrams}g</span> roastable
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                      {l.sizes.length === 0 ? (
                        <span className="text-danger">No bag sizes turned on</span>
                      ) : (
                        l.sizes.map((s) => (
                          <span key={s.label} className="inline-flex items-center gap-1">
                            <span className={`h-1.5 w-1.5 rounded-full ${DOT[s.availability]}`} />
                            {s.label} <span className="font-mono">{formatCents(s.priceCents)}</span>
                          </span>
                        ))
                      )}
                    </div>
                  </div>

                  <Link
                    href={`/beans/${row.beanId}`}
                    className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-foreground"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit listing
                  </Link>

                  <label className="flex items-center gap-2 text-sm font-medium">
                    <span className={l.isListed ? "text-success" : "text-muted"}>{l.isListed ? "Showing" : "Hidden"}</span>
                    <input
                      type="checkbox"
                      role="switch"
                      aria-label={`Show ${row.name} on the shop`}
                      className="h-4 w-4 accent-accent"
                      checked={l.isListed}
                      disabled={isPending}
                      onChange={(e) => run(() => setListingListed(l.id, e.target.checked))}
                    />
                  </label>
                </Card>
              </li>
            );
          })}
        </ol>
      )}

      <div>
        <p className="mb-2 text-sm font-medium">Not on the shop</p>
        {candidates.length === 0 ? (
          <p className="text-sm text-muted">Every coffee with stock is already on the shop.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {candidates.map((row) => (
              <li key={row.beanId} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <Link href={`/beans/${row.beanId}`} className="font-medium hover:underline">
                    {row.name}
                  </Link>
                  <p className="text-xs text-muted">
                    <span className="font-mono">{row.roastedGrams}g</span> roasted,{" "}
                    <span className="font-mono">{row.roastableGrams}g</span> roastable
                  </p>
                </div>
                <Button size="sm" variant="secondary" disabled={isPending} onClick={() => run(() => createShopListing(row.beanId))}>
                  Add to shop
                </Button>
              </li>
            ))}
          </ul>
        )}
        {extra > 0 && (
          <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-2 text-xs text-muted underline underline-offset-4">
            {showAll ? "Hide coffees with no stock" : `Show ${extra} coffees with no stock`}
          </button>
        )}
        <p className="mt-2 text-xs text-muted">
          Added coffees start hidden with the standard sizes and prices. Review them, then switch them to Showing.
        </p>
      </div>
    </div>
  );
}
