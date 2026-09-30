import { AlertTriangle, Hourglass, ShoppingCart } from "lucide-react";
import type { BeanAlert } from "@/lib/inventory";

/**
 * Renders one lot's alerts (low-stock / reorder / aging) as compact rows.
 * Icons carry the kind — no emoji anywhere per the repo's design rules.
 */
const KIND_META = {
  "low-stock": { icon: AlertTriangle, className: "text-warning" },
  reorder: { icon: ShoppingCart, className: "text-accent" },
  aging: { icon: Hourglass, className: "text-muted" },
} as const;

export default function AlertList({ alerts }: { alerts: BeanAlert[] }) {
  if (alerts.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1.5">
      {alerts.map((alert, i) => {
        const meta = KIND_META[alert.kind];
        const Icon = meta.icon;
        return (
          <li key={i} className={`flex items-start gap-2 text-sm ${meta.className}`}>
            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="text-foreground">{alert.message}</span>
          </li>
        );
      })}
    </ul>
  );
}
