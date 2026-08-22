import Link from "next/link";
import { Flame } from "lucide-react";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/beans", label: "Beans" },
  { href: "/roasts", label: "Roasts" },
  { href: "/friends", label: "Friends" },
] as const;

export default function Nav() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Flame className="h-5 w-5 text-accent" />
          Roasting
        </Link>
        <nav className="flex gap-4 text-sm">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="text-muted transition hover:text-foreground">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
