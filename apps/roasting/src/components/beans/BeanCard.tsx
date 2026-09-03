"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { deleteBean } from "@/lib/actions";
import DeleteButton from "@/components/DeleteButton";
import BeanEditForm from "@/components/beans/BeanEditForm";
import BeanStockBar from "@/components/beans/BeanStockBar";
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
    // No Card here — a bordered/shadowed box per row is what made this
    // list oversized; a flat row plus the wrapping list's hairline
    // dividers (see BeansPage's Section layout="list") reads as one
    // continuous list instead of a stack of separate boxes.
    <div className="flex items-center gap-3 py-2">
      <div className="min-w-0 flex-1">
        {/* No `truncate` here — its overflow:hidden would clip
            TapCircleLink's circle, which deliberately extends a few px
            past the text itself. A long name just wraps instead. */}
        <h3 className="font-medium">
          <TapCircleLink href={`/beans/${bean.id}`} className="hover:text-accent">
            {bean.name}
          </TapCircleLink>
        </h3>
        <p className="truncate text-sm text-muted">
          {bean.origin}
          {bean.producer ? ` · ${bean.producer}` : ""} · {bean.process}
          {bean.variety ? ` · ${bean.variety}` : ""}
        </p>
        {bean.notes && <p className="truncate text-sm text-foreground/80">{bean.notes}</p>}
      </div>
      {/* min-w, not a fixed w — the closed StockAdjuster state is a short
          line of text, but its open "adjust"/"set" state is an input plus
          several buttons that needs real room to grow into. */}
      <div className="min-w-36 flex-none text-right sm:min-w-44">
        <BeanStockBar bean={bean} />
      </div>
      <div className="flex flex-none items-center gap-2">
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          aria-label="Edit"
          className="text-muted transition hover:text-foreground"
        >
          <Pencil className="h-3 w-3" />
        </button>
        <DeleteButton
          variant="icon"
          action={deleteBean.bind(null, bean.id)}
          confirmText={`Delete ${bean.name}? This only works if no roasts are logged against it.`}
        />
      </div>
    </div>
  );
}
