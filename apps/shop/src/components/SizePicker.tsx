"use client";

import { useState } from "react";
import type { PublicVariant } from "@/lib/catalog";
import { formatCents } from "@/lib/shop-stock";
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
}: {
  variants: PublicVariant[];
  coffeeName: string;
  noticeDays: number;
}) {
  const firstBuyable = variants.find((v) => v.availability !== "sold_out") ?? null;
  const [selectedId, setSelectedId] = useState<string | null>(firstBuyable?.id ?? null);
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
                  onChange={() => setSelectedId(v.id)}
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
      </div>

      <button
        type="button"
        disabled
        aria-describedby="checkout-soon"
        className="mt-5 w-full rounded-lg border-2 border-[var(--border-strong)] bg-accent px-5 py-3 text-base font-semibold text-accent-foreground opacity-60 sm:w-auto"
      >
        Add {selected ? `${selected.label} of ${coffeeName}` : "to bag"}
      </button>
      <p id="checkout-soon" className="mt-2 text-sm text-muted">
        Online ordering opens soon. Until then, message us on Instagram to reserve a bag.
      </p>
    </div>
  );
}
