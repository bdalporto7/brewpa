"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Pencil } from "lucide-react";
import { deleteBean } from "@/lib/actions";
import DeleteButton from "@/components/DeleteButton";
import BeanEditForm from "@/components/BeanEditForm";
import Card from "@/components/ui/Card";
import type { Bean } from "@prisma/client";

export default function BeanCard({ bean }: { bean: Bean }) {
  const [isEditing, setIsEditing] = useState(false);
  const percentLeft = bean.weightGrams > 0 ? (bean.remainingGrams / bean.weightGrams) * 100 : 0;
  const isLow = percentLeft <= 15;

  if (isEditing) {
    return (
      <Card className="p-4">
        <BeanEditForm bean={bean} onDone={() => setIsEditing(false)} />
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-medium">{bean.name}</h3>
          <p className="text-sm text-muted">
            {bean.origin}
            {bean.producer ? ` · ${bean.producer}` : ""} · {bean.process}
            {bean.variety ? ` · ${bean.variety}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-1 text-xs font-medium text-muted transition hover:text-foreground"
          >
            <Pencil className="h-3 w-3" /> Edit
          </button>
          <DeleteButton
            action={deleteBean.bind(null, bean.id)}
            confirmText={`Delete ${bean.name}? This only works if no roasts are logged against it.`}
          />
        </div>
      </div>

      <div className="mt-3">
        <div className="flex justify-between font-mono text-xs text-muted">
          <span>
            {bean.remainingGrams}g left of {bean.weightGrams}g
          </span>
          <span>{Math.round(percentLeft)}%</span>
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-accent-soft">
          <div
            className={`h-full rounded-full ${isLow ? "bg-warning" : "bg-accent"}`}
            style={{ width: `${Math.max(0, Math.min(100, percentLeft))}%` }}
          />
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted">
        <div>
          <dt className="inline font-medium">Purchased: </dt>
          <dd className="inline">{format(bean.purchaseDate, "MMM d, yyyy")}</dd>
        </div>
        {bean.supplier && (
          <div>
            <dt className="inline font-medium">Supplier: </dt>
            <dd className="inline">{bean.supplier}</dd>
          </div>
        )}
        {bean.purchasePrice != null && (
          <div>
            <dt className="inline font-medium">Price: </dt>
            <dd className="inline">${bean.purchasePrice.toFixed(2)}</dd>
          </div>
        )}
      </dl>

      {bean.notes && <p className="mt-2 text-sm text-foreground/80">{bean.notes}</p>}
    </Card>
  );
}
