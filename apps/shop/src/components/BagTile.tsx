import Link from "next/link";
import Image from "next/image";
import type { PublicCoffee } from "@/lib/catalog";
import { formatCents } from "@/lib/shop-stock";
import AvailabilityNote from "@/components/AvailabilityNote";

/**
 * A coffee as its bag: kraft paper, a crimped heat-seal across the top, and
 * the white sticker label — the same object customers take home. This is
 * the site's one bold element; keep everything around it quiet.
 */
export default function BagTile({
  coffee,
  noticeDays,
  index = 0,
}: {
  coffee: PublicCoffee;
  noticeDays: number;
  index?: number;
}) {
  const soldOut = coffee.availability === "sold_out";
  return (
    <Link
      href={`/coffee/${coffee.slug}`}
      className="settle group block"
      style={{ ["--i" as string]: index }}
    >
      <article
        className={`kraft relative flex aspect-[4/5] flex-col overflow-hidden rounded-b-lg rounded-t-sm border-2 border-[var(--border-strong)] shadow-[3px_3px_0_var(--shadow-ink)] transition-transform duration-200 group-hover:-translate-y-1 group-focus-visible:-translate-y-1 ${soldOut ? "opacity-70" : ""}`}
      >
        {/* heat-seal crimp */}
        <div
          aria-hidden
          className="h-4 border-b-2 border-[var(--border-strong)] bg-kraft-deep"
          style={{
            backgroundImage:
              "repeating-linear-gradient(90deg, rgba(43,29,20,.22) 0 2px, transparent 2px 6px)",
          }}
        />

        {coffee.photoUrl ? (
          <div className="relative mx-4 mt-4 min-h-0 flex-1 overflow-hidden rounded-sm border-2 border-[var(--border-strong)] bg-label">
            <Image
              src={coffee.photoUrl}
              alt={`${coffee.name} bag`}
              fill
              sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 90vw"
              className="object-cover"
            />
          </div>
        ) : (
          // No photo: plain kraft above the label, like the top of a real bag.
          <div className="flex-1" />
        )}

        <div className="m-4 shrink-0 rounded-sm border-2 border-[var(--border-strong)] bg-label px-4 pb-4 pt-3 text-[#2b1d14] shadow-[1px_1px_0_var(--shadow-ink)]">
          <div className="flex items-start justify-between gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- static logo */}
            <img src="/cybar-mark.png" alt="" className="h-9 w-auto shrink-0" />
            {coffee.roastedOn && (
              <span className="-rotate-3 font-marker text-sm leading-tight text-[#8a3a24]">
                roasted {coffee.roastedOn.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            )}
          </div>
          <h3 className="mt-2 text-2xl font-extrabold leading-[1.05] tracking-tight [text-wrap:balance]">
            {coffee.name}
          </h3>
          <p className="mt-1 text-sm text-[#6f5f51]">
            {coffee.origin}, {coffee.process.toLowerCase()}
            {coffee.roastStyle ? `, ${coffee.roastStyle.toLowerCase()} roast` : ""}
          </p>
          <div className="mt-3 flex items-end justify-between gap-3 border-t border-dashed border-[#2b1d14]/30 pt-2.5">
            <span className="flex flex-col gap-1">
              <AvailabilityNote availability={coffee.availability} noticeDays={noticeDays} tone="label" />
              {coffee.lowStock && coffee.availability !== "sold_out" && (
                <span className="inline-flex w-fit items-center gap-1 rounded-sm border border-[#8a3a24] px-1.5 py-px text-[11px] font-bold text-[#8a3a24]">Low stock</span>
              )}
            </span>
            {coffee.fromPriceCents != null && (
              <span className="font-mono text-sm font-semibold">from {formatCents(coffee.fromPriceCents)}</span>
            )}
          </div>
        </div>
      </article>
    </Link>
  );
}
