"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Flame, Coffee } from "lucide-react";
import { logout } from "@/lib/auth-actions";

const ROASTING_LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/beans", label: "Beans" },
  { href: "/roasts", label: "Roasts" },
  { href: "/friends", label: "Drops" },
] as const;

const BREWING_LINKS = [
  { href: "/brews", label: "Brews" },
  { href: "/recipes", label: "Recipes" },
] as const;

function isBrewingPath(pathname: string) {
  return pathname.startsWith("/brews") || pathname.startsWith("/recipes");
}

export default function NavClient({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const mode = isBrewingPath(pathname) ? "brewing" : "roasting";
  const links = mode === "brewing" ? BREWING_LINKS : ROASTING_LINKS;

  return (
    <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
      <div className="flex items-center gap-3">
        <Link href={mode === "brewing" ? "/brews" : "/"} className="flex items-center gap-2">
          <picture>
            <source srcSet="/cybar-mark-dark.png" media="(prefers-color-scheme: dark)" />
            <img src="/cybar-mark.png" alt="Cybar Coffee" className="h-7 w-auto" />
          </picture>
          <span className="font-marker text-xl leading-none">Cybar</span>
        </Link>

        <div className="flex items-center rounded-full border-2 border-[var(--border-strong)] bg-surface p-0.5 text-xs font-medium">
          <Link
            href="/"
            className={`flex items-center gap-1 rounded-full px-3 py-1 transition ${
              mode === "roasting" ? "bg-accent text-accent-foreground" : "text-muted hover:text-foreground"
            }`}
          >
            <Flame className="h-3.5 w-3.5" />
            Roasting
          </Link>
          <Link
            href="/brews"
            className={`flex items-center gap-1 rounded-full px-3 py-1 transition ${
              mode === "brewing" ? "bg-accent text-accent-foreground" : "text-muted hover:text-foreground"
            }`}
          >
            <Coffee className="h-3.5 w-3.5" />
            Brewing
          </Link>
        </div>
      </div>

      <nav className="flex items-center gap-4 text-sm">
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
    </div>
  );
}
