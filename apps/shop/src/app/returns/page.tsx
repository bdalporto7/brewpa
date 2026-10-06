import type { Metadata } from "next";
import Link from "next/link";
import LegalPage, { ContactLine } from "@/components/LegalPage";
import { getSiteSettings } from "@/lib/site";

export const metadata: Metadata = { title: "Returns and refunds" };

export default async function ReturnsPage() {
  const s = await getSiteSettings();
  const contact = <ContactLine instagramUrl={s.instagramUrl} instagramHandle={s.instagramHandle} />;
  return (
    <LegalPage title="Returns and refunds" updated="October 5, 2026">
      <p>
        Coffee is a fresh food product, so we can&apos;t take back bags that have been opened or that have been out of
        our hands for a while. But if something&apos;s wrong, we&apos;ll make it right.
      </p>

      <h2>If something&apos;s wrong</h2>
      <p>
        If your order arrives damaged, is the wrong coffee, or isn&apos;t what you expected from us, {contact} within 7
        days of receiving it, with your order number (it starts with CY-) and, if you can, a photo. We&apos;ll replace
        it or refund you, whichever you prefer.
      </p>

      <h2>Changing or cancelling an order</h2>
      <p>
        Tell us as soon as you can. If we haven&apos;t started roasting or packing your order, we&apos;ll cancel it and
        refund you in full. Once your coffee is roasted for you, we can&apos;t cancel it.
      </p>

      <h2>Late or lost shipments</h2>
      <p>
        If a shipped order hasn&apos;t arrived within a reasonable time, tell us and we&apos;ll look into it with the
        carrier, and replace or refund it if it&apos;s lost.
      </p>

      <h2>How refunds are paid</h2>
      <p>
        Refunds go back to the card you paid with, through Square. Your bank usually takes several business days to
        show it.
      </p>

      <p>See also our <Link href="/terms">terms of sale</Link> and <Link href="/pickup-shipping">pickup and shipping</Link> details.</p>
    </LegalPage>
  );
}
