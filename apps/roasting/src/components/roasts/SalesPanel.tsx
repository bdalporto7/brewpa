import Link from "next/link";
import { format } from "date-fns";
import { RoastedBeanIcon } from "@/components/ui/CoffeeIcons";
import { recordSale, deleteSale, adjustRoastedStock, setRoastedStock } from "@/lib/actions";
import ActionForm from "@/components/ActionForm";
import DeleteButton from "@/components/DeleteButton";
import StockAdjuster from "@/components/StockAdjuster";
import Button from "@/components/ui/Button";
import SectionCard from "@/components/ui/SectionCard";
import { TextField } from "@/components/ui/Field";
import { formatCurrency } from "@/lib/format";
import type { RoastMargin } from "@/lib/economics";
import type { Friend, Sale } from "@prisma/client";

/**
 * `key={roastedRemainingGrams}` remounts the sale form after every logged
 * drop. Nothing here calls `form.reset()`, and the fields are uncontrolled,
 * so without forcing a fresh mount the weight/friend/price someone just
 * typed would still be sitting in the inputs for the next sale.
 */
export default function SalesPanel({
  roastSessionId,
  roastedRemainingGrams,
  sales,
  friends,
  margin,
}: {
  roastSessionId: string;
  roastedRemainingGrams: number;
  sales: (Sale & { friend: Friend | null })[];
  friends: Friend[];
  /** null when the bean has no purchasePrice recorded — shown as nothing,
   * never a fake $0 cost. See src/lib/economics.ts. */
  margin: RoastMargin | null;
}) {
  return (
    <SectionCard
      icon={<RoastedBeanIcon className="h-3.5 w-3.5" />}
      label="Drops"
      collapsible
      defaultCollapsed
      headerExtra={
        <StockAdjuster
          currentGrams={roastedRemainingGrams}
          unitLabel="left"
          onAdd={adjustRoastedStock.bind(null, roastSessionId, "add")}
          onRemove={adjustRoastedStock.bind(null, roastSessionId, "remove")}
          onSet={setRoastedStock.bind(null, roastSessionId)}
        />
      }
    >
      {margin && (
        <p className="mb-3 font-mono text-xs text-muted">
          Cost {formatCurrency(margin.totalCost)} · Sold {formatCurrency(margin.revenue)} ·{" "}
          <span className={margin.profit >= 0 ? "text-success" : "text-danger"}>
            Profit {formatCurrency(margin.profit)}
          </span>
        </p>
      )}

      {roastedRemainingGrams > 0 ? (
        <ActionForm
          key={roastedRemainingGrams}
          action={recordSale.bind(null, roastSessionId)}
          className="grid grid-cols-2 gap-3 sm:grid-cols-4"
        >
          <TextField label="Weight (g)" name="weightGrams" type="number" step="0.1" min="0.1" required placeholder="30" mono />
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted" htmlFor="friendName">
              Friend
            </label>
            <input
              id="friendName"
              name="friendName"
              list="friends-list"
              placeholder="e.g. Jake"
              autoComplete="off"
              className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm placeholder:text-muted/70 focus:border-accent focus:outline-none"
            />
            <datalist id="friends-list">
              {friends.map((friend) => (
                <option key={friend.id} value={friend.name} />
              ))}
            </datalist>
          </div>
          <TextField label="Price ($)" name="price" type="number" step="0.01" min="0" placeholder="Optional" mono />
          <div className="flex items-end">
            <Button type="submit" size="sm">
              Log drop
            </Button>
          </div>
        </ActionForm>
      ) : (
        <p className="text-sm text-muted">All of this roast has been dropped.</p>
      )}

      {sales.length > 0 && (
        <ul className="mt-4 flex flex-col divide-y divide-border border-t border-border">
          {sales.map((sale) => (
            <li key={sale.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <div>
                <span className="font-mono">{Math.round(sale.weightGrams * 10) / 10}g</span>
                {sale.friend && (
                  <span>
                    {" "}
                    —{" "}
                    <Link href={`/friends/${sale.friend.id}`} className="underline hover:text-accent">
                      {sale.friend.name}
                    </Link>
                  </span>
                )}
                {sale.price != null && <span className="text-muted"> · {formatCurrency(sale.price)}</span>}
                <span className="text-muted"> · {format(sale.soldAt, "MMM d")}</span>
              </div>
              <DeleteButton
                action={deleteSale.bind(null, roastSessionId, sale.id)}
                confirmText="Undo this drop? The weight will be returned to roasted stock."
                label="Undo"
              />
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
