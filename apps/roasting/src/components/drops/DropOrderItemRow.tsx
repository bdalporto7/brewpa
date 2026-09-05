"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { setDropOrderItemPaid, unfulfillDropOrderItem, deleteDropOrderItem, fulfillDropOrderItem } from "@/lib/drop-actions";
import ActionForm from "@/components/ActionForm";
import Button from "@/components/ui/Button";
import { SelectField, TextField } from "@/components/ui/Field";
import DeleteButton from "@/components/DeleteButton";
import Checkbox from "@/components/ui/Checkbox";
import { DROP_ORDER_ROAST_STYLE_LABELS } from "@/lib/constants";
import type { Bean, DropOrderItem, RoastSession, Sale } from "@prisma/client";

function PaidCheckbox({ dropId, item }: { dropId: string; item: DropOrderItem }) {
  const [isPending, startTransition] = useTransition();
  return (
    <Checkbox
      label="Paid"
      checked={item.paid}
      disabled={isPending}
      onChange={(e) => startTransition(() => setDropOrderItemPaid(dropId, item.id, e.target.checked))}
    />
  );
}

function FulfillForm({
  dropId,
  item,
  eligibleRoasts,
  onDone,
}: {
  dropId: string;
  item: DropOrderItem;
  eligibleRoasts: RoastSession[];
  onDone: () => void;
}) {
  return (
    <ActionForm
      action={fulfillDropOrderItem.bind(null, dropId, item.id)}
      onSuccess={onDone}
      className="mt-2 grid grid-cols-2 gap-2 rounded-md border border-border bg-background p-2 sm:grid-cols-[1fr_auto_auto]"
    >
      <SelectField label="From roast" name="roastSessionId" required defaultValue="">
        <option value="" disabled>
          Select roast
        </option>
        {eligibleRoasts.map((roast) => (
          <option key={roast.id} value={roast.id}>
            {format(roast.startedAt ?? roast.createdAt, "MMM d, yyyy")} (
            {Math.round((roast.roastedRemainingGrams ?? 0) * 10) / 10}g left)
          </option>
        ))}
      </SelectField>
      <TextField label="Roasted (g)" name="roastedWeightGrams" type="number" step="0.1" min="0.1" required mono />
      <div className="flex items-end gap-2">
        <Button type="submit" size="sm">
          Fulfill
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </ActionForm>
  );
}

export default function DropOrderItemRow({
  dropId,
  item,
  eligibleRoasts,
}: {
  dropId: string;
  item: DropOrderItem & { bean: Bean; sale: (Sale & { roastSession: RoastSession }) | null };
  eligibleRoasts: RoastSession[];
}) {
  const [isFulfilling, setIsFulfilling] = useState(false);
  const [isPending, startTransition] = useTransition();
  const styleLabel = DROP_ORDER_ROAST_STYLE_LABELS[item.roastStyle as keyof typeof DROP_ORDER_ROAST_STYLE_LABELS] ?? item.roastStyle;

  return (
    <li className="text-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Link href={`/beans/${item.bean.id}`} className="hover:text-accent">
            {item.bean.name}
          </Link>
          <span className="text-muted"> · {styleLabel}</span>
        </div>
        <div className="flex items-center gap-3">
          <PaidCheckbox dropId={dropId} item={item} />
          <DeleteButton
            action={deleteDropOrderItem.bind(null, dropId, item.id)}
            confirmText="Remove this pick from the order?"
            label="Remove"
          />
        </div>
      </div>

      {item.sale ? (
        <div className="mt-1 flex items-center justify-between gap-3 text-xs text-muted">
          <span>
            Fulfilled from {format(item.sale.roastSession.startedAt ?? item.sale.createdAt, "MMM d")} ·{" "}
            {Math.round(item.sale.weightGrams * 10) / 10}g roasted
          </span>
          <button
            type="button"
            disabled={isPending}
            onClick={() => startTransition(() => unfulfillDropOrderItem(dropId, item.id))}
            className="font-medium text-muted transition hover:text-foreground disabled:opacity-50"
          >
            Undo
          </button>
        </div>
      ) : isFulfilling ? (
        <FulfillForm dropId={dropId} item={item} eligibleRoasts={eligibleRoasts} onDone={() => setIsFulfilling(false)} />
      ) : eligibleRoasts.length > 0 ? (
        <button
          type="button"
          onClick={() => setIsFulfilling(true)}
          className="mt-1 text-xs font-medium text-muted transition hover:text-accent"
        >
          Fulfill from a roast
        </button>
      ) : (
        <p className="mt-1 text-xs text-muted">No completed roast of this bean with stock yet.</p>
      )}
    </li>
  );
}
