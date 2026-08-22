import type { ReactNode } from "react";

export default function Section({
  title,
  description,
  isEmpty,
  emptyText,
  children,
}: {
  title: string;
  description?: string;
  isEmpty: boolean;
  emptyText: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="font-medium">{title}</h2>
        {description && <p className="text-sm text-muted">{description}</p>}
      </div>
      {isEmpty ? (
        <p className="text-sm text-muted">{emptyText}</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
      )}
    </div>
  );
}
