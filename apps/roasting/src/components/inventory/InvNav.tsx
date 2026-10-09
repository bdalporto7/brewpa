"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";

const PRIMARY = [
  { href: "/inventory", label: "Home" },
  { href: "/inventory/runway", label: "Runway" },
  { href: "/inventory/leads", label: "Leads" },
  { href: "/inventory/lots", label: "Lots" },
];

const MORE = [
  { href: "/inventory/plan", label: "Plan" },
  { href: "/inventory/intake", label: "Intake" },
  { href: "/inventory/roasts", label: "Roasts" },
  { href: "/inventory/calculator", label: "Calculator" },
  { href: "/inventory/blends", label: "Blends" },
  { href: "/inventory/cupping", label: "Cupping" },
  { href: "/inventory/costs", label: "Costs" },
];

const pill = "block whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition";
const on = "bg-accent-soft text-accent ring-1 ring-inset ring-accent/30";
const off = "text-muted hover:bg-accent-soft hover:text-foreground";

/**
 * The inventory app's nav: the four things used daily stay as tabs, the
 * rest sit under "More" so the row never has to scroll sideways on a
 * phone. "More" lights up when you're on one of its pages.
 */
export default function InvNav() {
  const pathname = usePathname();
  // Remember which page the menu was opened on, so navigating closes it
  // without an effect that sets state.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (v: boolean) => setOpenOn(v ? pathname : null);
  const menuRef = useRef<HTMLLIElement>(null);

  const isActive = (href: string) => (href === "/inventory" ? pathname === href : pathname.startsWith(href));
  const moreActive = MORE.some((l) => isActive(l.href));

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpenOn(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenOn(null);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <nav aria-label="Inventory">
      <ul className="flex flex-wrap items-center gap-0.5 sm:gap-1">
        {PRIMARY.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              aria-current={isActive(link.href) ? "page" : undefined}
              className={`${pill} ${isActive(link.href) ? on : off}`}
            >
              {link.label}
            </Link>
          </li>
        ))}
        <li className="relative" ref={menuRef}>
          <button
            type="button"
            aria-expanded={open}
            aria-haspopup="menu"
            onClick={() => setOpen(!open)}
            className={`${pill} inline-flex items-center gap-1 ${moreActive ? on : off}`}
          >
            More <ChevronDown className={`h-3.5 w-3.5 transition ${open ? "rotate-180" : ""}`} />
          </button>
          {open && (
            <ul
              role="menu"
              className="absolute left-0 z-20 mt-1 min-w-40 rounded-2xl border border-border bg-surface p-1 shadow-2xl shadow-black/40"
            >
              {MORE.map((link) => (
                <li key={link.href} role="none">
                  <Link
                    role="menuitem"
                    href={link.href}
                    aria-current={isActive(link.href) ? "page" : undefined}
                    className={`${pill} ${isActive(link.href) ? on : off}`}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </li>
      </ul>
    </nav>
  );
}
