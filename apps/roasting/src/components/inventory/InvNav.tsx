"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/inventory", label: "Dashboard" },
  { href: "/inventory/lots", label: "Lots" },
  { href: "/inventory/intake", label: "Intake" },
  { href: "/inventory/roasts", label: "Roasts" },
  { href: "/inventory/calculator", label: "Calculator" },
  { href: "/inventory/plan", label: "Plan" },
  { href: "/inventory/blends", label: "Blends" },
  { href: "/inventory/cupping", label: "Cupping" },
  { href: "/inventory/costs", label: "Costs" },
];

/**
 * The inventory app's own nav — one flat row of links, horizontally
 * scrollable on small screens. No nested tabs, no second nav layer.
 */
export default function InvNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Inventory" className="-mx-1 overflow-x-auto px-1">
      <ul className="flex gap-1 pb-1">
        {LINKS.map((link) => {
          const active =
            link.href === "/inventory" ? pathname === "/inventory" : pathname.startsWith(link.href);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`block whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted hover:bg-accent-soft hover:text-foreground"
                }`}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
