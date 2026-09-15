"use client";

import { useState } from "react";
import { Coffee } from "lucide-react";
import { submitDropOrder } from "@/lib/drop-actions";
import { DROP_ORDER_ROAST_STYLES, DROP_ORDER_ROAST_STYLE_LABELS } from "@/lib/constants";
import { formatCurrency } from "@/lib/format";
import ActionForm from "@/components/ActionForm";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import type { Bean, DropItem } from "@prisma/client";

const fieldClass =
  "rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted/70 focus:border-accent focus:outline-none";

type Item = DropItem & { bean: Bean };
type CartEntry = { key: number; beanId: string; roastStyle: string };

/**
 * A real shop grid — photo, name, price, stock — instead of the old plain
 * bean/style dropdowns. Cart state lives client-side (picks accumulate into
 * `cart`, rendered as one hidden beanId/roastStyle input pair per entry);
 * submitDropOrder's wire contract (parallel getAll("beanId")/
 * getAll("roastStyle") arrays) hasn't changed, so the server action itself
 * only needed its stock-decrement logic touched, not this form's shape.
 * The per-card "N left" count only ever subtracts the *local* cart — it's
 * best-effort UX, not enforcement; submitDropOrder's own atomic conditional
 * update is what actually protects stock under a concurrent claim, and a
 * sold-out-during-race throw needs to land as an inline message (so the
 * buyer can just remove that pick and resubmit) rather than crash the page
 * — hence ActionForm here instead of a bare `<form action={...}>`.
 */
export default function DropOrderForm({ items }: { items: Item[] }) {
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [nextKey, setNextKey] = useState(0);
  const [roastStyleByBean, setRoastStyleByBean] = useState<Record<string, string>>({});

  if (items.length === 0) {
    return <p className="text-center text-sm text-muted">Nothing&apos;s available on this drop right now.</p>;
  }

  const itemsByBeanId = new Map(items.map((i) => [i.beanId, i]));

  function countInCart(beanId: string) {
    return cart.filter((c) => c.beanId === beanId).length;
  }

  function addToCart(item: Item) {
    const roastStyle = roastStyleByBean[item.beanId] ?? DROP_ORDER_ROAST_STYLES[0];
    setCart((prev) => [...prev, { key: nextKey, beanId: item.beanId, roastStyle }]);
    setNextKey((k) => k + 1);
  }

  function removeFromCart(key: number) {
    setCart((prev) => prev.filter((c) => c.key !== key));
  }

  return (
    <ActionForm action={submitDropOrder} successMessage={null} className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3">
        {items.map((item) => {
          const inCart = countInCart(item.beanId);
          const remaining = item.stockQuantity != null ? item.stockQuantity - inCart : null;
          const soldOut = remaining === 0;

          return (
            <Card
              key={item.id}
              interactive={false}
              className={`flex flex-col gap-2 p-3 ${soldOut ? "opacity-50" : ""}`}
            >
              <div className="flex h-24 items-center justify-center overflow-hidden rounded-lg bg-accent-soft">
                {item.bean.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- Blob URL, not a local asset next/image can optimize
                  <img src={item.bean.photoUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Coffee className="h-8 w-8 text-muted" />
                )}
              </div>
              <div>
                <p className="text-sm font-semibold">{item.bean.name}</p>
                {item.price != null && <p className="text-sm text-muted">{formatCurrency(item.price)}</p>}
              </div>
              {remaining != null && (
                <p className={`text-xs ${soldOut ? "font-medium text-danger" : "text-muted"}`}>
                  {soldOut ? "Out of stock" : `${remaining} left`}
                </p>
              )}
              <select
                value={roastStyleByBean[item.beanId] ?? DROP_ORDER_ROAST_STYLES[0]}
                onChange={(e) => setRoastStyleByBean((prev) => ({ ...prev, [item.beanId]: e.target.value }))}
                disabled={soldOut}
                className={fieldClass}
              >
                {DROP_ORDER_ROAST_STYLES.map((style) => (
                  <option key={style} value={style}>
                    {DROP_ORDER_ROAST_STYLE_LABELS[style]}
                  </option>
                ))}
              </select>
              <Button type="button" size="sm" disabled={soldOut} onClick={() => addToCart(item)}>
                {soldOut ? "Sold out" : "Add"}
              </Button>
            </Card>
          );
        })}
      </div>

      {cart.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
          <p className="text-xs font-medium text-muted">Your order</p>
          <ul className="flex flex-col gap-1.5">
            {cart.map((entry) => (
              <li key={entry.key} className="flex items-center justify-between gap-2 text-sm">
                <span>
                  {itemsByBeanId.get(entry.beanId)!.bean.name} ·{" "}
                  {DROP_ORDER_ROAST_STYLE_LABELS[entry.roastStyle as keyof typeof DROP_ORDER_ROAST_STYLE_LABELS]}
                </span>
                <button
                  type="button"
                  onClick={() => removeFromCart(entry.key)}
                  className="shrink-0 text-xs text-muted hover:text-danger"
                >
                  Remove
                </button>
                <input type="hidden" name="beanId" value={entry.beanId} />
                <input type="hidden" name="roastStyle" value={entry.roastStyle} />
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted" htmlFor="name">
          Your name
        </label>
        <input id="name" name="name" required className={fieldClass} placeholder="Your name" />
      </div>

      <Button type="submit" disabled={cart.length === 0} className="self-start">
        Submit order
      </Button>
    </ActionForm>
  );
}
