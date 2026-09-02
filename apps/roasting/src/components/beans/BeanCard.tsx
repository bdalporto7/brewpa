"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { deleteBean } from "@/lib/actions";
import DeleteButton from "@/components/DeleteButton";
import BeanEditForm from "@/components/beans/BeanEditForm";
import BeanStockBar from "@/components/beans/BeanStockBar";
import BeanMeta from "@/components/beans/BeanMeta";
import Card from "@/components/ui/Card";
import TapCircleLink from "@/components/ui/TapCircleLink";
import type { Bean } from "@prisma/client";

/** Same inline isEditing-toggle-to-BeanEditForm pattern as BeanHeader —
 * kept separate rather than merged since this one nests inside Card plus
 * the stock bar/meta rows, while BeanHeader is a page's plain top block. */
export default function BeanCard({ bean }: { bean: Bean }) {
  const [isEditing, setIsEditing] = useState(false);

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
          <h3 className="font-medium">
            <TapCircleLink href={`/beans/${bean.id}`} className="hover:text-accent">
              {bean.name}
            </TapCircleLink>
          </h3>
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
        <BeanStockBar bean={bean} />
      </div>

      <div className="mt-3">
        <BeanMeta bean={bean} />
      </div>

      {bean.notes && <p className="mt-2 text-sm text-foreground/80">{bean.notes}</p>}
    </Card>
  );
}
