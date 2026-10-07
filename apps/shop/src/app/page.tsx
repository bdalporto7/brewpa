import Link from "next/link";
import { getListedCoffees } from "@/lib/catalog";
import BagTile from "@/components/BagTile";
import EmptyShelf from "@/components/EmptyShelf";
import { getSiteSettings } from "@/lib/site";

// Stock changes whenever a roast is logged; never serve a stale shelf for long.
export const revalidate = 60;

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
    </>
  );
}
