import Link from "next/link";
import { getSiteSettings } from "@/lib/site";
import { formatCents } from "@/lib/shop-stock";

export default async function SiteFooter() {
  const s = await getSiteSettings();
  return (
    <footer className="mt-24 bg-ink-band text-ink-band-fg">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-3 sm:px-6">
        <div>
          <p className="font-marker text-2xl">{s.name}</p>
          {s.instagramUrl && (
            <a href={s.instagramUrl} className="mt-4 inline-block text-sm underline underline-offset-4 hover:text-white">
              {s.instagramHandle ?? "Instagram"} on Instagram
            </a>
          )}
        </div>
        <div className="text-sm">
          <p className="font-semibold">Pickup</p>
          <p className="mt-2 text-ink-band-muted">{s.localSummary}</p>
          <p className="mt-4 font-semibold">Shipping</p>
          <p className="mt-2 text-ink-band-muted">
            {formatCents(s.shippingFlatCents)} flat, free over {formatCents(s.freeShippingOverCents)}
          </p>
        </div>
        <nav aria-label="Footer" className="text-sm">
          <ul className="space-y-2">
            <li><Link href="/shop" className="hover:text-white">Shop coffee</Link></li>
            <li><Link href="/about" className="hover:text-white">About Cybar</Link></li>
            <li><Link href="/pickup-shipping" className="hover:text-white">Pickup & shipping</Link></li>
            <li><Link href="/returns" className="hover:text-white">Returns & refunds</Link></li>
            <li><Link href="/terms" className="hover:text-white">Terms of sale</Link></li>
            <li><Link href="/privacy" className="hover:text-white">Privacy policy</Link></li>
          </ul>
        </nav>
      </div>
      <p className="mx-auto max-w-6xl px-4 pb-8 text-xs text-ink-band-muted sm:px-6">
        © {new Date().getFullYear()} {s.name}, San Francisco
      </p>
    </footer>
  );
}
