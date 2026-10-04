import type { Metadata } from "next";
import { getSiteSettings } from "@/lib/site";
import { formatCents } from "@/lib/shop-stock";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSiteSettings();
  return {
    title: "Pickup & shipping",
    description: `${s.localSummary}, or shipping for ${formatCents(s.shippingFlatCents)}, free over ${formatCents(s.freeShippingOverCents)}.`,
  };
}

export default async function PickupShippingPage() {
  const s = await getSiteSettings();
  const notice =
    s.noticeDays > 0 ? `about ${s.noticeDays} ${s.noticeDays === 1 ? "day" : "days"}` : "a little extra time";

  const faq = [
    {
      q: "How long until my coffee is ready?",
      a: `If the coffee is already roasted it's ready within a day or so. If we're roasting it for your order, allow ${notice}. Each coffee's page says which it is.`,
    },
    {
      q: "Is it whole bean?",
      a: "Yes, every bag is whole bean. Grind right before you brew and it'll taste better for longer.",
    },
    {
      q: "When should I drink it?",
      a: "Freshly roasted coffee needs a few days to rest before it tastes its best, and lighter roasts often keep improving for a week or two. Each bag is marked with its roast date.",
    },
    ...(s.instagramUrl
      ? [
          {
            q: "Something's wrong with my order",
            a: `Message us on Instagram${s.instagramHandle ? ` at ${s.instagramHandle}` : ""} and we'll sort it out.`,
          },
        ]
      : []),
  ];

  const card = "rounded-lg border-2 border-[var(--border-strong)] bg-surface p-7 shadow-[3px_3px_0_var(--shadow-ink)]";

  return (
    <div className="mx-auto max-w-6xl px-4 pt-12 sm:px-6">
      <h1 className="text-5xl font-extrabold tracking-tight">Pickup & shipping</h1>

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <section className={card}>
          <h2 className="text-2xl font-bold">In San Francisco</h2>
          <p className="mt-4 text-lg font-semibold">{s.localSummary}</p>
          <p className="mt-4 leading-relaxed text-muted">
            Order and we&apos;ll get in touch to arrange a pickup or drop-off once your bag is ready. If we&apos;re
            roasting it for you, allow {notice}.
          </p>
        </section>

        <section className={card}>
          <h2 className="text-2xl font-bold">Get it shipped</h2>
          <p className="mt-4 text-lg font-semibold">
            {formatCents(s.shippingFlatCents)} flat rate, anywhere in the US
          </p>
          <p className="mt-1 text-lg">Free on orders over {formatCents(s.freeShippingOverCents)}</p>
          <p className="mt-4 leading-relaxed text-muted">We ship after roasting, so your coffee leaves us fresh.</p>
        </section>
      </div>

      <section className="mt-16 max-w-3xl">
        <h2 className="text-3xl font-extrabold tracking-tight">Questions</h2>
        <dl className="mt-6 divide-y-2 divide-border">
          {faq.map((f) => (
            <div key={f.q} className="py-5">
              <dt className="text-lg font-bold">{f.q}</dt>
              <dd className="mt-2 max-w-[62ch] leading-relaxed text-muted">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
