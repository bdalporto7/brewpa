"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Flame,
  CalendarRange,
  Blend,
  CircleDollarSign,
} from "lucide-react";

/**
 * Sub-navigation for the /inventory section. Horizontally scrollable on
 * phones — six tabs is too many for a fixed pill row at 390px, and the
 * section's secondary pages (calculator, cupping, intake) are reached
 * contextually from the pages that need them rather than crowding this.
 */
const TABS = [
  { href: "/inventory", label: "Overview", icon: LayoutDashboard },
  { href: "/inventory/lots", label: "Lots", icon: Package },
  { href: "/inventory/roasts", label: "Roasts", icon: Flame },
  { href: "/inventory/plan", label: "Plan", icon: CalendarRange },
  { href: "/inventory/blends", label: "Blends", icon: Blend },
  { href: "/inventory/costs", label: "Costs", icon: CircleDollarSign },
] as const;

export default function InventoryNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Inventory"
      className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
    >
      {TABS.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(tab.href + "/");
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              active
                ? "bg-accent text-accent-foreground"
                : "border border-border bg-surface text-muted hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
