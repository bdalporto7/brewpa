import type { Metadata } from "next";
import Link from "next/link";
import { getListedCoffees } from "@/lib/catalog";
import BagTile from "@/components/BagTile";
import EmptyShelf from "@/components/EmptyShelf";
import { getSiteSettings } from "@/lib/site";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Shop coffee",
  description: "Every coffee we're roasting right now, by the bag.",
};

/**
 * Filters are plain links (?process=natural) so they work without JS, can be
 * shared, and the page stays a server component. Only filter values that
 * actually exist in the current lineup are offered.
 */
export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ process?: string; origin?: string }>;
}) {
  const { process, origin } = await searchParams;
  const [all, settings] = await Promise.all([getListedCoffees(), getSiteSettings()]);
  const coffees = all.filter(
    (c) =>
      (!process || c.process.toLowerCase() === process) && (!origin || c.origin.toLowerCase() === origin)
  );
  const processes = [...new Set(all.map((c) => c.process.toLowerCase()))].sort();
  const origins = [...new Set(all.map((c) => c.origin.toLowerCase()))].sort();

  return (
    <div className="mx-auto max-w-6xl px-4 pt-12 sm:px-6">
      <h1 className="text-5xl font-extrabold tracking-tight">Shop coffee</h1>
      <p className="mt-3 max-w-[56ch] text-lg text-muted">
        Everything we&apos;re roasting right now. Every bag is whole bean, from a 4 oz sampler up to 5 lb.
      </p>

      {all.length > 1 && (
        <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-sm">
          <FilterRow label="Process" param="process" values={processes} active={process} other={{ origin }} />
          <FilterRow label="Origin" param="origin" values={origins} active={origin} other={{ process }} />
        </div>
      )}

      <div className="mt-8">
        {all.length === 0 ? (
          <EmptyShelf />
        ) : coffees.length === 0 ? (
          <p className="text-muted">
            Nothing matches that filter.{" "}
            <Link href="/shop" className="underline underline-offset-4">
              Show every coffee
            </Link>
          </p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {coffees.map((c, i) => (
              <BagTile key={c.slug} coffee={c} noticeDays={settings.noticeDays} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FilterRow({
  label,
  param,
  values,
  active,
  other,
}: {
  label: string;
  param: string;
  values: string[];
  active?: string;
  other: Record<string, string | undefined>;
}) {
  if (values.length < 2) return null;
  const href = (value?: string) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...other, [param]: value })) if (v) q.set(k, v);
    const s = q.toString();
    return s ? `/shop?${s}` : "/shop";
  };
  const pill = (on: boolean) =>
    `rounded-full border-2 px-3 py-1 capitalize ${on ? "border-[var(--border-strong)] bg-foreground text-background" : "border-border hover:border-[var(--border-strong)]"}`;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 font-semibold">{label}</span>
      <Link href={href(undefined)} className={pill(!active)} aria-current={!active ? "page" : undefined}>
        Any
      </Link>
      {values.map((v) => (
        <Link key={v} href={href(v)} className={pill(active === v)} aria-current={active === v ? "page" : undefined}>
          {v}
        </Link>
      ))}
    </div>
  );
}
