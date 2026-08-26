"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { deleteBean } from "@/lib/actions";
import DeleteButton from "@/components/DeleteButton";
import BeanEditForm from "@/components/BeanEditForm";
import type { Bean } from "@prisma/client";

export default function BeanHeader({ bean }: { bean: Bean }) {
  const [isEditing, setIsEditing] = useState(false);

  if (isEditing) {
    return <BeanEditForm bean={bean} onDone={() => setIsEditing(false)} />;
  }

  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-4xl font-black tracking-tight">{bean.name}</h1>
        <p className="text-sm text-muted">
          {bean.origin}
          {bean.producer ? ` · ${bean.producer}` : ""} · {bean.process}
          {bean.variety ? ` · ${bean.variety}` : ""}
        </p>
        {bean.notes && <p className="mt-1 text-sm text-foreground/80">{bean.notes}</p>}
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
  );
}
