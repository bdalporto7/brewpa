import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentAllowedUser } from "@/lib/admin";
import { beanStock, variantAvailability } from "@/lib/shop-stock";
import SectionHeading from "@/components/ui/SectionHeading";
import ShopManagerList, { type ManagerRow } from "@/components/shop/ShopManagerList";
import SquareSyncButton from "@/components/shop/SquareSyncButton";
import ShopSettingsForm from "@/components/shop/ShopSettingsForm";

/**
 * The storefront's control room: which coffees the public shop (apps/shop)
 * shows and in what order, plus every site-wide setting (announcement,
 * homepage copy, About text, local + shipping terms). Open to every team
 * member, like the rest of this app. Per-coffee copy and bag sizes are
 * edited on each bean's own page (ShopListingCard) — this page links there.
 */
export default async function ShopManagerPage() {
  const user = await getCurrentAllowedUser();
  if (!user) notFound();

  const [beans, settings] = await Promise.all([
    prisma.bean.findMany({
      where: { teamId: user.teamId },
      include: {
        shopListing: { include: { variants: true } },
        roastSessions: {
          select: { endedAt: true, greenWeightGrams: true, roastedWeightGrams: true, roastedRemainingGrams: true },
        },
      },
    }),
    prisma.shopSettings.findUnique({ where: { teamId: user.teamId } }),
  ]);

  const rows: ManagerRow[] = beans.map((bean) => {
    const stock = beanStock(bean, bean.roastSessions);
    const listing = bean.shopListing;
    const active = (listing?.variants ?? []).filter((v) => v.active);
    return {
      beanId: bean.id,
      name: bean.name,
      origin: bean.origin,
      process: bean.process,
      roastedGrams: Math.round(stock.roastedGrams),
      roastableGrams: Math.round(stock.roastableGrams),
      listing: listing
        ? {
            id: listing.id,
            slug: listing.slug,
            isListed: listing.isListed,
            sortOrder: listing.sortOrder,
            createdAt: listing.createdAt.getTime(),
            sizes: active
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((v) => ({ label: v.label, priceCents: v.priceCents, availability: variantAvailability(stock, v.grams) })),
          }
        : null,
    };
  });

  const onShop = rows
    .filter((r) => r.listing)
    .sort((a, b) => a.listing!.sortOrder - b.listing!.sortOrder || a.listing!.createdAt - b.listing!.createdAt);
  const notOnShop = rows
    .filter((r) => !r.listing)
    .sort((a, b) => b.roastedGrams + b.roastableGrams - (a.roastedGrams + a.roastableGrams) || a.name.localeCompare(b.name));

  const openOrders = await prisma.shopOrder.count({
    where: { teamId: user.teamId, status: { in: ["PAID", "NEEDS_ATTENTION", "READY"] } },
  });
  const shopUrl = process.env.SHOP_PUBLIC_URL ?? null;

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="text-4xl font-black tracking-tight">Shop</h1>
        <p className="mt-2 max-w-prose text-sm text-muted">
          Choose which coffees appear on the online shop and in what order, and edit the site&apos;s text, shipping and
          local pickup/delivery terms. Changes show on the shop within about a minute.
          {shopUrl && (
            <>
              {" "}
              <a href={shopUrl} target="_blank" rel="noreferrer" className="font-medium text-foreground underline underline-offset-4">
                Open the shop
              </a>
            </>
          )}
        </p>
      </div>

      <Link
        href="/shop/orders"
        className="flex items-center justify-between rounded-xl border-2 border-[var(--border-strong)] bg-surface px-4 py-3 font-semibold shadow-[2px_2px_0_var(--shadow-ink)]"
      >
        <span>Online orders</span>
        <span className="font-mono text-sm text-muted">{openOrders > 0 ? `${openOrders} open` : "none open"}</span>
      </Link>

      <section>
        <div className="mb-3">
          <SectionHeading>Coffees</SectionHeading>
        </div>
        <ShopManagerList onShop={onShop} notOnShop={notOnShop} />
      </section>

      <section>
        <div className="mb-3">
          <SectionHeading>Pop-ups</SectionHeading>
        </div>
        <p className="mb-3 max-w-prose text-sm text-muted">
          Listed coffees are copied to Square as register items (one per bag size) so you can ring them up at a
          pop-up. Selling one there takes the grams out of stock automatically. This happens each time you save a
          listing; use the button to resend everything.
        </p>
        <SquareSyncButton />
      </section>

      <section>
        <div className="mb-3">
          <SectionHeading>Site settings</SectionHeading>
        </div>
        <ShopSettingsForm settings={settings} />
      </section>
    </div>
  );
}
