import { format } from "date-fns";
import type { Bean } from "@prisma/client";

/** One line, not a label/value grid — a formatted date and a $-prefixed
 * number don't need "Purchased:"/"Price:" labels to read unambiguously,
 * and dropping the grid is most of what makes BeanCard fit more rows on
 * screen without losing any of the information. */
export default function BeanMeta({ bean }: { bean: Bean }) {
  return (
    <p className="text-xs text-muted">
      {format(bean.purchaseDate, "MMM d, yyyy")}
      {(bean.supplier || bean.supplierUrl) && (
        <>
          {" · "}
          {bean.supplierUrl ? (
            <a href={bean.supplierUrl} target="_blank" rel="noreferrer" className="underline hover:text-accent">
              {bean.supplier || "Source link"}
            </a>
          ) : (
            bean.supplier
          )}
        </>
      )}
      {bean.purchasePrice != null && ` · $${bean.purchasePrice.toFixed(2)}`}
    </p>
  );
}
