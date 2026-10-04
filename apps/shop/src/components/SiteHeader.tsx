import Link from "next/link";

const LINKS = [
  { href: "/shop", label: "Shop coffee" },
  { href: "/about", label: "About" },
  { href: "/pickup-shipping", label: "Pickup & shipping" },
];

export default function SiteHeader() {
  return (
    <header className="border-b-2 border-[var(--border-strong)] bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75 sticky top-0 z-20">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2" aria-label="Cybar Coffee home">
          <picture>
            <source srcSet="/cybar-mark-dark.png" media="(prefers-color-scheme: dark)" />
            <img src="/cybar-mark.png" alt="" className="h-9 w-auto" />
          </picture>
          <span className="font-marker text-xl leading-none">Cybar Coffee</span>
        </Link>
        <nav aria-label="Main">
          <ul className="flex items-center gap-1 text-sm font-medium sm:gap-2">
            {LINKS.map((l) => (
              <li key={l.href} className={l.href === "/shop" ? "" : "hidden sm:block"}>
                <Link
                  href={l.href}
                  className={
                    l.href === "/shop"
                      ? "rounded-lg border-2 border-[var(--border-strong)] bg-accent px-3 py-1.5 text-accent-foreground shadow-[2px_2px_0_var(--shadow-ink)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                      : "rounded-md px-2.5 py-1.5 text-muted hover:text-foreground"
                  }
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
