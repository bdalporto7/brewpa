import Link from "next/link";
import { getListedCoffees } from "@/lib/catalog";
import BagTile from "@/components/BagTile";
import EmptyShelf from "@/components/EmptyShelf";
import { getSiteSettings, type SiteSettings } from "@/lib/site";
import { formatCents } from "@/lib/shop-stock";

// Stock changes whenever a roast is logged; never serve a stale shelf for long.
export const revalidate = 60;

function steps(s: SiteSettings) {
  return [
    {
      title: "Pick a coffee and a bag size",
      body: "From a 4 oz sampler to a 5 lb bag. Every bag is whole bean.",
    },
    {
      title: "We roast it in a small batch",
      body:
        s.noticeDays > 0
          ? `If it isn't already on the shelf we roast it for you, so allow about ${s.noticeDays} ${s.noticeDays === 1 ? "day" : "days"}.`
          : "If it isn't already on the shelf we roast it for you.",
    },
    {
      title: "Pick it up or get it shipped",
      body: `${s.localSummary}. Or we ship it for ${formatCents(s.shippingFlatCents)}, free over ${formatCents(s.freeShippingOverCents)}.`,
    },
  ];
}

export default async function HomePage() {
  const [coffees, settings] = await Promise.all([getListedCoffees(), getSiteSettings()]);
  const shelf = coffees.slice(0, 6);

  return (
    <>
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-12 sm:px-6 md:grid-cols-[1.1fr_1fr] md:pt-20">
        <div>
          <h1 className="text-5xl font-extrabold leading-[0.95] tracking-tight [text-wrap:balance] sm:text-6xl lg:text-7xl">
            {settings.name}
          </h1>
          <p className="mt-6 max-w-[46ch] text-lg leading-relaxed text-muted">
            Whole bean coffee by the bag, from a 4 oz sampler up to 5 lb. {settings.localSummary}. Or we can ship it.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              href="/shop"
              className="rounded-lg border-2 border-[var(--border-strong)] bg-accent px-5 py-3 text-base font-semibold text-accent-foreground shadow-[3px_3px_0_var(--shadow-ink)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
            >
              Shop coffee
            </Link>
          </div>
        </div>
        {/* The hero is a bag: kraft with the brand sticker on it. */}
        <div className="kraft relative mx-auto w-full max-w-md rounded-b-lg rounded-t-sm border-2 border-[var(--border-strong)] shadow-[4px_4px_0_var(--shadow-ink)]">
          <div
            aria-hidden
            className="h-5 border-b-2 border-[var(--border-strong)] bg-kraft-deep"
            style={{
              backgroundImage: "repeating-linear-gradient(90deg, rgba(43,29,20,.22) 0 2px, transparent 2px 6px)",
            }}
          />
          <div className="px-8 pb-10 pt-12">
            <div className="-rotate-2 rounded-sm border-2 border-[var(--border-strong)] bg-label p-8 shadow-[2px_2px_0_var(--shadow-ink)]">
              {/* eslint-disable-next-line @next/next/no-img-element -- static brand art, used as-is */}
              <img src="/cybar-stamp.png" alt="Cybar Coffee" className="mx-auto w-full" />
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="shelf" className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <h2 id="shelf" className="text-3xl font-extrabold tracking-tight">
            On the shelf now
          </h2>
          {coffees.length > shelf.length && (
            <Link href="/shop" className="font-medium underline underline-offset-4">
              See all {coffees.length} coffees
            </Link>
          )}
        </div>
        {shelf.length === 0 ? (
          <EmptyShelf />
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {shelf.map((c, i) => (
              <BagTile key={c.slug} coffee={c} noticeDays={settings.noticeDays} index={i} />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="how" className="mx-auto mt-24 max-w-6xl px-4 sm:px-6">
        <h2 id="how" className="text-3xl font-extrabold tracking-tight">
          How ordering works
        </h2>
        <ol className="mt-8 grid gap-8 md:grid-cols-3">
          {steps(settings).map((s, i) => (
            <li key={s.title} className="border-l-4 border-brand pl-5">
              <span className="font-marker text-3xl text-brand">{i + 1}</span>
              <h3 className="mt-1 text-lg font-bold">{s.title}</h3>
              <p className="mt-2 max-w-[38ch] leading-relaxed text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
