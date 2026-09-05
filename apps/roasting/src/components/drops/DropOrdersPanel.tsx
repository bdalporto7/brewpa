import Link from "next/link";
import { format } from "date-fns";
import { deleteDropOrder } from "@/lib/drop-actions";
import DeleteButton from "@/components/DeleteButton";
import DropOrderItemRow from "@/components/drops/DropOrderItemRow";
import Card from "@/components/ui/Card";
import Eyebrow from "@/components/ui/Eyebrow";
import type { Bean, DropOrderItem, Friend, RoastSession, Sale } from "@prisma/client";

type OrderWithItems = {
  id: string;
  name: string;
  createdAt: Date;
  friend: Friend | null;
  items: (DropOrderItem & { bean: Bean; sale: (Sale & { roastSession: RoastSession }) | null })[];
};

export default function DropOrdersPanel({
  dropId,
  orders,
  eligibleRoastsByBean,
}: {
  dropId: string;
  orders: OrderWithItems[];
  eligibleRoastsByBean: Record<string, RoastSession[]>;
}) {
  return (
    <Card interactive={false} className="p-4">
      <Eyebrow className="mb-3">Orders</Eyebrow>

      {orders.length === 0 ? (
        <p className="text-sm text-muted">No orders yet — share the code above.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {orders.map((order) => (
            <li key={order.id} className="py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="font-medium">
                  {order.friend ? (
                    <Link href={`/friends/${order.friend.id}`} className="hover:text-accent">
                      {order.name}
                    </Link>
                  ) : (
                    order.name
                  )}
                  <span className="ml-2 text-xs font-normal text-muted">{format(order.createdAt, "MMM d")}</span>
                </div>
                <DeleteButton
                  action={deleteDropOrder.bind(null, dropId, order.id)}
                  confirmText="Remove this whole order?"
                  label="Remove order"
                />
              </div>
              <ul className="mt-2 flex flex-col gap-2">
                {order.items.map((item) => (
                  <DropOrderItemRow
                    key={item.id}
                    dropId={dropId}
                    item={item}
                    eligibleRoasts={eligibleRoastsByBean[item.beanId] ?? []}
                  />
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
