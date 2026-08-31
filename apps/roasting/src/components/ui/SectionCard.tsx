"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

/**
 * The shared "labeled, bordered card, optionally collapsible" shell used
 * across the roast pages — icon + uppercase label always inside the same
 * box as its content (not floating above a separately-bordered element),
 * with an optional chevron-collapse for sections that are reference
 * material rather than something checked every time (event history, the
 * manual-correction form) rather than each hand-rolling its own header/
 * collapse state.
 */
export default function SectionCard({
  icon,
  label,
  collapsible = false,
  defaultCollapsed = false,
  headerExtra,
  children,
}: {
  icon: ReactNode;
  label: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  /** Extra header content (e.g. a link or toggle) shown to the right of the label, hidden while collapsed. */
  headerExtra?: ReactNode;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(collapsible && defaultCollapsed);

  return (
    <div className="rounded-xl border-2 border-[var(--border-strong)] bg-surface shadow-[2px_2px_0_var(--shadow-ink)] p-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => collapsible && setCollapsed((v) => !v)}
          disabled={!collapsible}
          className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted uppercase"
        >
          {icon}
          {label}
          {collapsible && (
            <ChevronDown className={`h-3 w-3 transition-transform ${collapsed ? "" : "rotate-180"}`} />
          )}
        </button>
        {!collapsed && headerExtra}
      </div>
      {!collapsed && <div className="mt-3">{children}</div>}
    </div>
  );
}
