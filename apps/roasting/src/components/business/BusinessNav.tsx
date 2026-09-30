"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Sub-navigation for the Business section (/business/*). The section's
 * own nav area — Costs (the economics dashboard) and Roast Plan
 * (monthly roast commitments) — without adding another top-level tab
 * to the main nav's already-full mobile tab bar.
 */
const TABS = [
  { href: "/business", label: "Costs" },
  { href: "/business/roast-plan", label: "Roast Plan" },
] as const;

export default function BusinessNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 rounded-full bg-white/[0.07] p-0.5 text-sm font-medium w-fit">
      {TABS.map((tab) => {
        const active =
          tab.href === "/business" ? pathname === "/business" : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-full px-4 py-1.5 transition ${
              active
                ? "bg-panel-accent text-panel-bg"
                : "text-panel-muted hover:text-panel-fg"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
