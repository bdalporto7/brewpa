"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { createCheckout, priceCartAction } from "@/app/cart/actions";
import type { PricedCart } from "@/lib/checkout";
import { setQty, useCart } from "@/lib/cart-store";
import { formatCents } from "@/lib/shop-stock";

interface Props {
  settings: { noticeDays: number; shippingFlatCents: number; freeShippingOverCents: number; localSummary: string };
  earliestPickup: string;
}

const field =
  "w-full rounded-lg border-2 border-border bg-surface px-3 py-2 focus-visible:border-[var(--border-strong)] focus-visible:outline-none";

export default function CartView({ settings, earliestPickup }: Props) {
  const lines = useCart();
  const [priced, setPriced] = useState<PricedCart | null>(null);
  const [fulfillment, setFulfillment] = useState<"PICKUP" | "SHIPMENT">("PICKUP");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const key = JSON.stringify(lines);

  useEffect(() => {
    let live = true;
    if (lines.length === 0) return;
    priceCartAction(lines).then((p) => live && setPriced(p));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` captures `lines`
  }, [key]);

  if (lines.length === 0) {
    return (
      <div className="mt-10 rounded-lg border-2 border-dashed border-[var(--border-strong)] px-6 py-12 text-center">
        <p className="text-xl font-bold">Your bag is empty.</p>
        <Link href="/shop" className="mt-4 inline-block font-medium underline underline-offset-4">
          Shop coffee
        </Link>
      </div>
    );
  }
  if (!priced) return <p className="mt-10 text-muted">Loading your bag…</p>;

  const shipping =
    fulfillment === "SHIPMENT" && priced.subtotalCents < settings.freeShippingOverCents ? settings.shippingFlatCents : 0;
  const total = priced.subtotalCents + shipping;

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      const res = await createCheckout({
        lines,
        fulfillment,
        pickupDate: fulfillment === "PICKUP" ? String(f.get("pickupDate") ?? "") : null,
        name: String(f.get("name") ?? ""),
        email: String(f.get("email") ?? ""),
        phone: String(f.get("phone") ?? ""),
      });
      if ("error" in res) setError(res.error);
      else window.location.href = res.url;
    });
  }

  return (
    <div className="mt-8 grid gap-10 md:grid-cols-[1fr_22rem]">
      <ul className="divide-y-2 divide-border">
        {priced.lines.map((l) => (
          <li key={l.variantId} className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div>
              <Link href={`/coffee/${l.slug}`} className="text-lg font-bold underline-offset-4 hover:underline">
                {l.coffeeName}
              </Link>
              <p className="text-sm text-muted">
                {l.label} · {formatCents(l.unitPriceCents)} each
                {l.availability === "roast_to_order" && !l.problem
                  ? ` · roasted to order, allow ${settings.noticeDays} days`
                  : ""}
              </p>
              {l.problem && <p className="mt-1 text-sm font-semibold text-accent">{l.problem}</p>}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center rounded-lg border-2 border-border">
                <button type="button" aria-label={`Fewer ${l.coffeeName} ${l.label}`} className="px-3 py-1" onClick={() => setQty(l.variantId, l.qty - 1)}>
                  −
                </button>
                <span className="min-w-6 text-center font-mono">{l.qty}</span>
                <button type="button" aria-label={`More ${l.coffeeName} ${l.label}`} className="px-3 py-1" onClick={() => setQty(l.variantId, l.qty + 1)}>
                  +
                </button>
              </div>
              <span className="w-16 text-right font-mono font-semibold">{formatCents(l.lineCents)}</span>
            </div>
          </li>
        ))}
      </ul>

      <form onSubmit={submit} className="space-y-5 rounded-lg border-2 border-[var(--border-strong)] bg-surface p-5 shadow-[3px_3px_0_var(--shadow-ink)]">
        <fieldset>
          <legend className="mb-2 font-semibold">How do you want it?</legend>
          <div className="space-y-2">
            {(
              [
                ["PICKUP", settings.localSummary, "We'll email to arrange the time"],
                ["SHIPMENT", "Ship it to me", `${formatCents(settings.shippingFlatCents)} flat, free over ${formatCents(settings.freeShippingOverCents)}`],
              ] as const
            ).map(([value, title, sub]) => (
              <label key={value} className="flex cursor-pointer items-start gap-3 rounded-lg border-2 border-border p-3 has-[:checked]:border-[var(--border-strong)]">
                <input type="radio" name="fulfillment" checked={fulfillment === value} onChange={() => setFulfillment(value)} className="mt-1" />
                <span>
                  <span className="block font-semibold">{title}</span>
                  <span className="block text-sm text-muted">{sub}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {fulfillment === "PICKUP" && (
          <label className="block">
            <span className="mb-1 block font-semibold">Preferred date</span>
            <input type="date" name="pickupDate" required min={earliestPickup} defaultValue={earliestPickup} className={field} />
            <span className="mt-1 block text-sm text-muted">At least {settings.noticeDays} days out, so we can roast it fresh.</span>
          </label>
        )}

        <label className="block">
          <span className="mb-1 block font-semibold">Name</span>
          <input name="name" required autoComplete="name" className={field} />
        </label>
        <label className="block">
          <span className="mb-1 block font-semibold">Email</span>
          <input name="email" type="email" required autoComplete="email" className={field} />
        </label>
        <label className="block">
          <span className="mb-1 block font-semibold">Phone <span className="font-normal text-muted">(optional)</span></span>
          <input name="phone" type="tel" autoComplete="tel" className={field} />
        </label>

        <dl className="space-y-1 border-t-2 border-border pt-4 text-sm">
          <div className="flex justify-between"><dt>Subtotal</dt><dd className="font-mono">{formatCents(priced.subtotalCents)}</dd></div>
          {fulfillment === "SHIPMENT" && (
            <div className="flex justify-between"><dt>Shipping</dt><dd className="font-mono">{shipping === 0 ? "Free" : formatCents(shipping)}</dd></div>
          )}
          <div className="flex justify-between text-base font-bold"><dt>Total</dt><dd className="font-mono">{formatCents(total)}</dd></div>
        </dl>

        {error && <p role="alert" className="text-sm font-semibold text-accent">{error}</p>}
        <button
          type="submit"
          disabled={pending || !priced.ok}
          className="w-full rounded-lg border-2 border-[var(--border-strong)] bg-accent px-5 py-3 text-base font-semibold text-accent-foreground shadow-[3px_3px_0_var(--shadow-ink)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none disabled:opacity-60"
        >
          {pending ? "Opening checkout…" : "Pay with Square"}
        </button>
        <p className="text-center text-xs text-muted">You&apos;ll enter payment on Square&apos;s secure page.</p>
      </form>
    </div>
  );
}
