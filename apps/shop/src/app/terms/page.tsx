import type { Metadata } from "next";
import Link from "next/link";
import LegalPage, { ContactLine } from "@/components/LegalPage";
import { getSiteSettings } from "@/lib/site";
import { formatCents } from "@/lib/shop-stock";

export const metadata: Metadata = { title: "Terms of sale" };

export default async function TermsPage() {
  const s = await getSiteSettings();
  const contact = <ContactLine instagramUrl={s.instagramUrl} instagramHandle={s.instagramHandle} />;
  return (
    <LegalPage title="Terms of sale" updated="October 5, 2026">
      <p>
        These terms apply when you buy from {s.name} through this website. By placing an order you agree to them.
        Please also read our <Link href="/privacy">privacy policy</Link> and <Link href="/returns">returns and refunds</Link>.
      </p>

      <h2>Who we are</h2>
      <p>{s.name} is a small coffee roaster in San Francisco, California. To reach us, {contact}.</p>

      <h2>Orders and prices</h2>
      <ul>
        <li>Prices are in US dollars and shown for each bag size. If sales tax applies to your order, it&apos;s added at checkout.</li>
        <li>An order is accepted when your payment goes through and you see the confirmation. We may cancel an order, with a full refund, if an item is unavailable, a price was clearly shown in error, or we can&apos;t deliver to you.</li>
        <li>Payments are handled by Square. You&apos;ll enter your card details on Square&apos;s page, not ours.</li>
      </ul>

      <h2>Availability and made-to-order coffee</h2>
      <p>
        We roast in small batches. Some coffees are roasted to order and some are on backorder when we&apos;re out of
        beans; the product page says which. Timing for these is an estimate, and we&apos;ll be in touch if it changes.
        Coffee is a fresh product, so we&apos;d rather roast it for you than sell you something stale.
      </p>

      <h2>Pickup, local delivery and shipping</h2>
      <ul>
        <li><strong>Pickup or local delivery in the Bay Area:</strong> choose a preferred date at checkout (at least {s.noticeDays} days out). We&apos;ll contact you to arrange the exact time and place.</li>
        <li><strong>Shipping:</strong> {formatCents(s.shippingFlatCents)} flat rate within the US, free on orders over {formatCents(s.freeShippingOverCents)}. We ship after roasting. Delivery times depend on the carrier and are not guaranteed.</li>
        <li>Please give us an accurate address. If a package is returned because the address was wrong, we may charge you to reship it.</li>
      </ul>

      <h2>Food information</h2>
      <p>
        Our coffee is a food product. If you have allergies or dietary questions, {contact} before you order. We can&apos;t
        guarantee that any product is free of every allergen.
      </p>

      <h2>Problems with your order</h2>
      <p>See <Link href="/returns">returns and refunds</Link>. Nothing in these terms limits any rights you have under the law.</p>

      <h2>Limits on our responsibility</h2>
      <p>
        To the extent the law allows, our responsibility for any order is limited to the amount you paid for it, and
        we aren&apos;t liable for indirect or consequential losses. We aren&apos;t responsible for delays outside our
        control, such as carrier problems or weather. This does not limit liability that can&apos;t be limited by law.
      </p>

      <h2>This website</h2>
      <p>
        Everything on this site, including text, photos and logos, belongs to {s.name} or is used with permission. Please
        don&apos;t copy it without asking. We work to keep the site accurate and available but can&apos;t promise it will
        always be error-free or uninterrupted.
      </p>

      <h2>Governing law</h2>
      <p>These terms are governed by the laws of the State of California, and disputes will be handled in the courts of California.</p>

      <h2>Changes</h2>
      <p>We may update these terms. The version in effect when you place an order is the one that applies to it.</p>
    </LegalPage>
  );
}
