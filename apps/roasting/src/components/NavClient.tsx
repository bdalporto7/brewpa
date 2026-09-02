"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Flame, Home, Gift, BookOpen, Shield, LogOut } from "lucide-react";
import { logout } from "@/lib/auth-actions";
import { BrewedCupIcon, GreenBeanIcon } from "@/components/ui/CoffeeIcons";
import CybarMark from "@/components/ui/CybarMark";
import SteamWisp from "@/components/ui/SteamWisp";
import WaterPour from "@/components/ui/WaterPour";

const ROASTING_LINKS = [
  { href: "/", label: "Dashboard", icon: Home },
  // lucide's own "Bean" glyph is a kidney bean, not a coffee bean — use
  // the real coffee-bean shape already built for the dashboard instead.
  { href: "/beans", label: "Beans", icon: GreenBeanIcon },
  { href: "/roasts", label: "Roasts", icon: Flame },
  { href: "/profiles", label: "Profiles", icon: BookOpen },
  { href: "/friends", label: "Drops", icon: Gift },
] as const;

const BREWING_LINKS = [
  { href: "/brews", label: "Brews", icon: BrewedCupIcon },
  { href: "/recipes", label: "Recipes", icon: BookOpen },
] as const;

function isBrewingPath(pathname: string) {
  return pathname.startsWith("/brews") || pathname.startsWith("/recipes");
}

export default function NavClient({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const mode = isBrewingPath(pathname) ? "brewing" : "roasting";
  const links = mode === "brewing" ? BREWING_LINKS : ROASTING_LINKS;

  return (
    <>
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Link href={mode === "brewing" ? "/brews" : "/"} className="flex items-center gap-2">
            <CybarMark className="h-7 w-auto" />
            <span className="font-marker text-xl leading-none">Cybar</span>
          </Link>

          <div className="flex items-center rounded-full border-2 border-[var(--border-strong)] bg-surface p-0.5 text-xs font-medium">
            <Link
              href="/"
              className={`flex items-center gap-1 rounded-full px-3 py-1 transition ${
                mode === "roasting" ? "bg-accent text-accent-foreground" : "text-muted hover:text-foreground"
              }`}
            >
              <span className="relative inline-flex">
                <Flame className="h-3.5 w-3.5" />
                {mode === "roasting" && (
                  // Explicit color, not inherited: this sits inside the active
                  // pill's text-accent-foreground, which in dark mode is the
                  // exact same value as the page background — invisible where
                  // the wisp pokes above the pill. text-foreground always
                  // contrasts against both the pill and the nav bar.
                  <SteamWisp className="pointer-events-none absolute -top-3.5 left-0 h-3.5 w-5 text-foreground" />
                )}
              </span>
              Roasting
            </Link>
            <Link
              href="/brews"
              className={`flex items-center gap-1 rounded-full px-3 py-1 transition ${
                mode === "brewing" ? "bg-accent text-accent-foreground" : "text-muted hover:text-foreground"
              }`}
            >
              <span className="relative inline-flex">
                <BrewedCupIcon className="h-3.5 w-3.5" />
                {mode === "brewing" && (
                  <WaterPour className="pointer-events-none absolute -top-3.5 left-0.5 h-3.5 w-5 text-foreground" />
                )}
              </span>
              Brewing
            </Link>
          </div>
        </div>

        {/* Desktop nav: full text links, room enough to never wrap. Below
            sm:, this collapses in favor of the fixed bottom tab bar plus the
            icon-only admin/logout pair to the right — the same six items
            crammed into one row here would wrap mid-word on a phone (this
            is literally what used to happen before). */}
        <nav className="hidden items-center gap-4 text-sm sm:flex">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="text-muted transition hover:text-foreground">
              {link.label}
            </Link>
          ))}
          {isAdmin && (
            <Link href="/admin" className="text-muted transition hover:text-foreground">
              Admin
            </Link>
          )}
          <form action={logout}>
            <button type="submit" className="text-muted transition hover:text-foreground">
              Log out
            </button>
          </form>
        </nav>

        {/* Mobile equivalent of the admin/logout pair above — icon-only
            since these are rare actions that don't need their own bottom
            tab, unlike the links in `links` below. */}
        <div className="flex items-center gap-3 sm:hidden">
          {isAdmin && (
            <Link href="/admin" aria-label="Admin" className="text-muted transition hover:text-foreground">
              <Shield className="h-5 w-5" />
            </Link>
          )}
          <form action={logout}>
            <button type="submit" aria-label="Log out" className="text-muted transition hover:text-foreground">
              <LogOut className="h-5 w-5" />
            </button>
          </form>
        </div>
      </div>

      {/* Fixed bottom tab bar, mobile only — matches the native tab-bar
          convention this app is meant to feel like on a phone (doubly true
          now that it's also wrapped as a real iOS app via Capacitor), and
          keeps the small number of pages you actually jump between reachable
          with a thumb without any menu to open first. */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-[var(--border-strong)] bg-surface sm:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className={`grid ${links.length === 2 ? "grid-cols-2" : links.length === 5 ? "grid-cols-5" : "grid-cols-4"}`}>
          {links.map((link) => {
            const active = pathname === link.href;
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition ${
                  active ? "text-accent" : "text-muted"
                }`}
              >
                <Icon className="h-5 w-5" />
                {link.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
