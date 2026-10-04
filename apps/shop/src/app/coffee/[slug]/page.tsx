import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCoffee } from "@/lib/catalog";
import SizePicker from "@/components/SizePicker";
import { getSiteSettings } from "@/lib/site";

export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const coffee = await getCoffee(slug);
  if (!coffee) return { title: "Coffee not found" };
  return {
    title: coffee.name,
    description: coffee.headline ?? `${coffee.name}, ${coffee.process.toLowerCase()} coffee from ${coffee.origin}.`,
    openGraph: coffee.photoUrl ? { images: [coffee.photoUrl] } : undefined,
  };
}

export default async function CoffeePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [coffee, settings] = await Promise.all([getCoffee(slug), getSiteSettings()]);
  if (!coffee) notFound();

  const facts: [string, string | null][] = [
    ["Origin", coffee.origin],
    ["Producer", coffee.producer],
    ["Process", coffee.process],
    ["Variety", coffee.variety],
    ["Roast", coffee.roastStyle],
    [
      "Roasted",
      coffee.roastedOn?.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) ?? null,
    ],
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 pt-8 sm:px-6">
      <Link href="/shop" className="text-sm text-muted underline-offset-4 hover:underline">
        All coffees
      </Link>

      <div className="mt-6 grid gap-10 md:grid-cols-2 md:gap-14">
        <div>
          {coffee.photoUrl ? (
            <div className="relative aspect-square overflow-hidden rounded-lg border-2 border-[var(--border-strong)] bg-label shadow-[4px_4px_0_var(--shadow-ink)]">
              <Image
                src={coffee.photoUrl}
                alt={`${coffee.name} bag`}
                fill
                priority
                sizes="(min-width: 768px) 50vw, 100vw"
                className="object-cover"
              />
            </div>
          ) : (
            <div className="kraft flex aspect-square items-center justify-center rounded-lg border-2 border-[var(--border-strong)] p-12 shadow-[4px_4px_0_var(--shadow-ink)]">
              {/* eslint-disable-next-line @next/next/no-img-element -- brand art, used as-is */}
              <img src="/cybar-stamp.png" alt="" className="w-3/4 -rotate-2" />
            </div>
          )}
        </div>

        <div>
          <h1 className="text-4xl font-extrabold leading-[1.02] tracking-tight [text-wrap:balance] sm:text-5xl">
            {coffee.name}
          </h1>
          {coffee.headline && <p className="mt-3 text-xl leading-snug">{coffee.headline}</p>}

          <SizePicker variants={coffee.variants} coffeeName={coffee.name} noticeDays={settings.noticeDays} />

          {coffee.description && (
            <div className="mt-10">
              <h2 className="text-lg font-bold">About this coffee</h2>
              <p className="mt-2 max-w-[62ch] whitespace-pre-line leading-relaxed text-muted">{coffee.description}</p>
            </div>
          )}

          <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-4 border-t-2 border-[var(--border-strong)] pt-6 text-sm">
            {facts
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k}>
                  <dt className="text-muted">{k}</dt>
                  <dd className="mt-0.5 font-semibold">{v}</dd>
                </div>
              ))}
          </dl>

          {coffee.brewNotes && (
            <div className="mt-8 rounded-lg bg-accent-soft p-5">
              <h2 className="font-bold">How we brew it</h2>
              <p className="mt-1.5 whitespace-pre-line leading-relaxed">{coffee.brewNotes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
