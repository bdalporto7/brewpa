"use client";

import { useState } from "react";
import type { PublicVariant } from "@/lib/catalog";
import { formatCents } from "@/lib/shop-stock";
import Link from "next/link";
import { addToCart } from "@/lib/cart-store";
import AvailabilityNote from "@/components/AvailabilityNote";

/**
 * Bag-size choice for one coffee. Sold-out sizes stay visible (so the
 * lineup reads consistently across coffees) but can't be chosen. The first
 * size that can be bought is preselected.
 */
export default function SizePicker({
  variants,
  coffeeName,
  noticeDays,
  lowStock = false,
}: {
  variants: PublicVariant[];
  coffeeName: string;
  noticeDays: number;
  lowStock?: boolean;
}) {
  const firstBuyable = variants.find((v) => v.availability !== "sold_out") ?? null;
  const [selectedId, setSelectedId] = useState<string | null>(firstBuyable?.id ?? null);
  const [added, setAdded] = useState(false);
  const selected = variants.find((v) => v.id === selectedId) ?? null;

  return (
    <div className="mt-8">
      <fieldset>
        <legend className="mb-2 font-semibold">Bag size</legend>
        <div className="flex flex-wrap gap-2">
          {variants.map((v) => {
            const disabled = v.availability === "sold_out";
            const on = v.id === selectedId;
            return (
              <label
                key={v.id}
                className={`cursor-pointer rounded-lg border-2 px-3.5 py-2 text-sm transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent ${
                  disabled
                    ? "cursor-not-allowed border-border text-muted line-through"
                    : on
                      ? "border-[var(--border-strong)] bg-foreground text-background"
                      : "border-border hover:border-[var(--border-strong)]"
                }`}
              >
                <input
                  type="radio"
                  name="size"
                  value={v.id}
                  checked={on}
                  disabled={disabled}
                  onChange={() => {
                    setSelectedId(v.id);
                    setAdded(false);
                  }}
                  className="sr-only"
                />
                <span className="font-semibold">{v.label}</span>{" "}
                <span className="font-mono">{formatCents(v.priceCents)}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
        <span className="font-mono text-3xl font-bold">{selected ? formatCents(selected.priceCents) : "Sold out"}</span>
        {selected && <AvailabilityNote availability={selected.availability} noticeDays={noticeDays} />}
        {selected && lowStock && (
          <span className="inline-flex items-center rounded-md border-2 border-accent px-2 py-0.5 text-xs font-bold text-accent">Low stock</span>
        )}
      </div>

      <button
        type="button"
        disabled={!selected}
        onClick={() => {
          if (!selected) return;
          addToCart(selected.id);
          setAdded(true);
        }}
        className="mt-5 w-full rounded-lg border-2 border-[var(--border-strong)] bg-accent px-5 py-3 text-base font-semibold text-accent-foreground shadow-[3px_3px_0_var(--shadow-ink)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none disabled:opacity-60 sm:w-auto"
      >
        Add {selected ? `${selected.label} of ${coffeeName}` : "to bag"}
      </button>
      <p className="mt-3 text-sm" role="status" aria-live="polite">
        {added ? (
          <>
            Added to your bag.{" "}
            <Link href="/cart" className="font-semibold underline underline-offset-4">
              View bag and check out
            </Link>
          </>
        ) : null}
      </p>
    </div>
  );
}
