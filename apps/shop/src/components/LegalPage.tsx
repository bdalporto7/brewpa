import type { ReactNode } from "react";

/** Plain, readable layout for the policy pages: one column, generous line height. */
export default function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-12 sm:px-6">
      <h1 className="text-5xl font-extrabold tracking-tight">{title}</h1>
      <p className="mt-3 text-sm text-muted">Last updated {updated}</p>
      <div className="mt-8 space-y-4 leading-relaxed [&_h2]:mt-10 [&_h2]:text-2xl [&_h2]:font-extrabold [&_h2]:tracking-tight [&_li]:ml-5 [&_li]:list-disc [&_a]:underline [&_a]:underline-offset-4">
        {children}
      </div>
    </div>
  );
}

/** How to reach us about orders and privacy; uses the business email when one is set, else Instagram. */
export function ContactLine({ instagramUrl, instagramHandle }: { instagramUrl: string | null; instagramHandle: string | null }) {
  const email = process.env.SHOP_CONTACT_EMAIL;
  if (email) return <a href={`mailto:${email}`}>{email}</a>;
  if (instagramUrl) return <a href={instagramUrl}>message {instagramHandle ?? "us"} on Instagram</a>;
  return <>contact us through the shop</>;
}
