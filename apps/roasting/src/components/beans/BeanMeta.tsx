import { format } from "date-fns";
import type { Bean } from "@prisma/client";

export default function BeanMeta({ bean }: { bean: Bean }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted">
      <div>
        <dt className="inline font-medium">Purchased: </dt>
        <dd className="inline">{format(bean.purchaseDate, "MMM d, yyyy")}</dd>
      </div>
      {(bean.supplier || bean.supplierUrl) && (
        <div>
          <dt className="inline font-medium">Supplier: </dt>
          <dd className="inline">
            {bean.supplierUrl ? (
              <a
                href={bean.supplierUrl}
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-accent"
              >
                {bean.supplier || "Source link"}
              </a>
            ) : (
              bean.supplier
            )}
          </dd>
        </div>
      )}
      {bean.purchasePrice != null && (
        <div>
          <dt className="inline font-medium">Price: </dt>
          <dd className="inline">${bean.purchasePrice.toFixed(2)}</dd>
        </div>
      )}
    </dl>
  );
}
