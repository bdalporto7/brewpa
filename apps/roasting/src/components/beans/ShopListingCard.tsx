"use client";

import { useState, useTransition } from "react";
import { Store } from "lucide-react";
import type { BeanListing, ListingVariant } from "@prisma/client";
import { createShopListing, setListingListed, updateShopListing } from "@/lib/shop-actions";
import { variantAvailability, type BeanStock, type Availability } from "@/lib/shop-stock";
import SectionCard from "@/components/ui/SectionCard";
import ActionForm from "@/components/ActionForm";
import Button from "@/components/ui/Button";
import { TextField, TextareaField, SelectField } from "@/components/ui/Field";

const ROAST_STYLES = ["Light", "Light-medium", "Medium", "Medium-dark", "Dark", "Omni"];

const AVAILABILITY_LABEL: Record<Availability, { text: string; className: string }> = {
  ready: { text: "Ready", className: "text-success" },
  roast_to_order: { text: "Roast to order", className: "text-warning" },
  backorder: { text: "Backorder", className: "text-warning" },
  sold_out: { text: "Not enough stock", className: "text-danger" },
};

/**
 * The bean page's link to the public storefront (apps/shop). Everything the
 * shop shows for this coffee is edited here — there is no separate shop
 * admin — so adding/removing a coffee from the site is one toggle on the
 * bean the roaster already manages. Availability per bag size is computed
 * from real stock (roasted on hand first, then green × this bean's own
 * historical yield), the same math the shop uses.
 */
export default function ShopListingCard({
  beanId,
  listing,
  stock,
}: {
  beanId: string;
  listing: (BeanListing & { variants: ListingVariant[] }) | null;
  stock: BeanStock;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

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

  if (!listing) {
    return (
      <SectionCard icon={<Store className="h-3.5 w-3.5" />} label="Online shop">
        <p className="mb-3 text-sm text-muted">
          Not on the shop yet. Set it up with the standard bag sizes and prices — you can edit everything
          before it goes live.
        </p>
        <Button size="sm" onClick={() => run(() => createShopListing(beanId))} disabled={isPending}>
          {isPending ? "Setting up…" : "Set up for the shop"}
        </Button>
        {error && <p className="mt-2 text-xs text-danger">{error}</p>}
      </SectionCard>
    );
  }

  const variants = [...listing.variants].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <SectionCard
      icon={<Store className="h-3.5 w-3.5" />}
      label="Online shop"
      headerExtra={
        <label className="flex items-center gap-2 text-sm font-medium">
          <span className={listing.isListed ? "text-success" : "text-muted"}>
            {listing.isListed ? "Selling online" : "Not listed"}
          </span>
          <input
            type="checkbox"
            role="switch"
            aria-label="Sell this coffee online"
            className="h-4 w-4 accent-accent"
            checked={listing.isListed}
            disabled={isPending}
            onChange={(e) => run(() => setListingListed(listing.id, e.target.checked))}
          />
        </label>
      }
    >
      {error && <p className="mb-2 text-xs text-danger">{error}</p>}

      <p className="mb-3 text-xs text-muted">
        <span className="font-mono">{Math.round(stock.roastedGrams)}g</span> roasted on hand ·{" "}
        <span className="font-mono">{Math.round(stock.roastableGrams)}g</span> more roastable from green (at{" "}
        <span className="font-mono">{Math.round(stock.yield * 100)}%</span> yield)
      </p>

      <ActionForm
        action={updateShopListing.bind(null, listing.id)}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
      >
        <TextField label="Shop URL slug" name="slug" defaultValue={listing.slug} mono />
        <SelectField label="Roast style" name="roastStyle" defaultValue={listing.roastStyle ?? ""}>
          <option value="">—</option>
          {ROAST_STYLES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </SelectField>
        <div className="sm:col-span-2">
          <TextField
            label="Headline"
            name="headline"
            defaultValue={listing.headline ?? ""}
            placeholder="Juicy natural Ethiopian — blueberry, jasmine, cocoa"
          />
        </div>
        <div className="sm:col-span-2">
          <TextareaField
            label="Shop description"
            name="description"
            rows={4}
            defaultValue={listing.description ?? ""}
            placeholder="What it tastes like, where it's from, why you're excited about it."
          />
        </div>
        <div className="sm:col-span-2">
          <TextareaField
            label="Brew notes (optional)"
            name="brewNotes"
            rows={2}
            defaultValue={listing.brewNotes ?? ""}
            placeholder="V60, 15g : 250g, 93°C, rest 7+ days"
          />
        </div>

        <label className="flex items-start gap-2 sm:col-span-2">
          <input type="checkbox" name="allowBackorder" defaultChecked={listing.allowBackorder} className="mt-0.5 h-4 w-4 accent-accent" />
          <span className="text-sm">
            <span className="font-medium">Keep taking orders when out of stock</span>
            <span className="block text-xs text-muted">
              Customers pay now and see &ldquo;on backorder.&rdquo; The coffee they&apos;re waiting on shows up on the
              Online orders page as green to buy.
            </span>
          </span>
        </label>

        <div className="sm:col-span-2">
          <p className="mb-1.5 text-xs font-medium text-muted">Bag sizes</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="pb-1 font-medium">On</th>
                  <th className="pb-1 font-medium">Label</th>
                  <th className="pb-1 font-medium">Grams</th>
                  <th className="pb-1 font-medium">Price ($)</th>
                  <th className="pb-1 font-medium">Stock</th>
                </tr>
              </thead>
              <tbody>
                {variants.map((v) => {
                  const a = AVAILABILITY_LABEL[variantAvailability(stock, v.grams, listing.allowBackorder)];
                  return (
                    <tr key={v.id} className="border-t border-border">
                      <td className="py-1.5 pr-2">
                        <input
                          type="checkbox"
                          name={`variant.${v.id}.active`}
                          defaultChecked={v.active}
                          aria-label={`Sell ${v.label}`}
                          className="accent-accent"
                        />
                      </td>
                      <td className="py-1.5 pr-2">
                        <input
                          name={`variant.${v.id}.label`}
                          defaultValue={v.label}
                          className="w-20 rounded-md border border-border bg-surface px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="py-1.5 pr-2">
                        <input
                          name={`variant.${v.id}.grams`}
                          type="number"
                          min={1}
                          step="any"
                          defaultValue={v.grams}
                          className="w-20 rounded-md border border-border bg-surface px-2 py-1 font-mono text-sm"
                        />
                      </td>
                      <td className="py-1.5 pr-2">
                        <input
                          name={`variant.${v.id}.price`}
                          type="number"
                          min={0.01}
                          step={0.01}
                          defaultValue={(v.priceCents / 100).toFixed(2)}
                          className="w-20 rounded-md border border-border bg-surface px-2 py-1 font-mono text-sm"
                        />
                      </td>
                      <td className={`py-1.5 text-xs ${a.className}`}>{a.text}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="sm:col-span-2">
          <Button type="submit" size="sm">
            Save shop listing
          </Button>
        </div>
      </ActionForm>
    </SectionCard>
  );
}
