"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { deleteBean } from "@/lib/actions";
import DeleteButton from "@/components/DeleteButton";
import BeanEditForm from "@/components/BeanEditForm";
import BeanStockBar from "@/components/BeanStockBar";
import BeanMeta from "@/components/BeanMeta";
import Card from "@/components/ui/Card";
import type { Bean } from "@prisma/client";

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
          <Link href={`/beans/${bean.id}`} className="hover:text-accent">
            <h3 className="font-medium">{bean.name}</h3>
          </Link>
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
