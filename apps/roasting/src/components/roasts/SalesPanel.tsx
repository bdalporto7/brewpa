import Link from "next/link";
import { format } from "date-fns";
import { Coffee } from "lucide-react";
import { recordSale, deleteSale } from "@/lib/actions";
import ActionForm from "@/components/ActionForm";
import DeleteButton from "@/components/DeleteButton";
import Button from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import type { Friend, Sale } from "@prisma/client";

export default function SalesPanel({
  roastSessionId,
  roastedRemainingGrams,
  sales,
  friends,
}: {
  roastSessionId: string;
  roastedRemainingGrams: number;
  sales: (Sale & { friend: Friend | null })[];
  friends: Friend[];
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted uppercase">
          <Coffee className="h-3.5 w-3.5" />
          Drops
        </span>
        <span className="font-mono text-xs text-muted">{roastedRemainingGrams}g left</span>
      </div>

      {roastedRemainingGrams > 0 ? (
        <ActionForm
          key={roastedRemainingGrams}
          action={recordSale.bind(null, roastSessionId)}
          className="grid grid-cols-2 gap-3 sm:grid-cols-4"
        >
          <TextField label="Weight (g)" name="weightGrams" type="number" step="1" min="1" required placeholder="30" mono />
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
                <span className="font-mono">{sale.weightGrams}g</span>
                {sale.friend && (
                  <span>
                    {" "}
                    —{" "}
                    <Link href={`/friends/${sale.friend.id}`} className="underline hover:text-accent">
                      {sale.friend.name}
                    </Link>
                  </span>
                )}
                {sale.price != null && <span className="text-muted"> · ${sale.price.toFixed(2)}</span>}
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
    </div>
  );
}
