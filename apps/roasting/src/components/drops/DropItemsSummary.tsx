import { Coffee } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import type { Bean, DropItem } from "@prisma/client";

/** Read-only admin-side view of what a drop is offering — thumbnail, name,
 * price, remaining stock. Inline post-creation price/stock editing is a
 * natural follow-up, not built here. */
export default function DropItemsSummary({ items }: { items: (DropItem & { bean: Bean })[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-2 rounded-lg border border-border p-2">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-accent-soft">
            {item.bean.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- Blob URL, not a local asset next/image can optimize
              <img src={item.bean.photoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <Coffee className="h-4 w-4 text-muted" />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{item.bean.name}</p>
            <p className="text-xs text-muted">
              {item.price != null ? formatCurrency(item.price) : "—"}
              {item.stockQuantity != null && ` · ${item.stockQuantity} left`}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
