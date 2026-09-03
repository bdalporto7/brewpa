import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

export default function Section({
  title,
  description,
  isEmpty,
  emptyText,
  children,
  layout = "grid",
  collapsible = false,
  defaultCollapsed = false,
  count,
}: {
  title: string;
  description?: string;
  isEmpty: boolean;
  emptyText: string;
  children: ReactNode;
  /** "list" is a flat, single-column stack with hairline dividers between
   * rows (no per-item card border/shadow) — for lists of many short rows
   * (bean stock), where a 2-column card grid was mostly just taller boxes
   * with more scrolling, not more information. Default "grid" is
   * unchanged for anything with real per-item card content. */
  layout?: "grid" | "list";
  /** Native <details>, not useState — a plain disclosure needs no client
   * component, and this only sets the *initial* open/closed state
   * (uncontrolled after mount, same as every other <details> in the app). */
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  /** Shown next to the title so a collapsed section still says how much
   * is behind it, e.g. "Out of Stock — Green (4)". */
  count?: number;
}) {
  const titleContent = (
    <>
      {title}
      {count != null && <span className="ml-1.5 font-normal text-muted">({count})</span>}
    </>
  );

  const body = isEmpty ? (
    <p className="text-sm text-muted">{emptyText}</p>
  ) : layout === "list" ? (
    <div className="divide-y divide-border border-t border-border">{children}</div>
  ) : (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
  );

  if (collapsible) {
    return (
      <details className="group" open={!defaultCollapsed}>
        <summary className="flex cursor-pointer list-none items-center gap-1 font-medium [&::-webkit-details-marker]:hidden">
          <ChevronRight className="h-4 w-4 text-muted transition-transform group-open:rotate-90" />
          {titleContent}
        </summary>
        {description && <p className="ml-5 text-sm text-muted">{description}</p>}
        <div className="mt-3 ml-5">{body}</div>
      </details>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="font-medium">{titleContent}</h2>
        {description && <p className="text-sm text-muted">{description}</p>}
      </div>
      {body}
    </div>
  );
}
