import type { Metadata } from "next";
import LegalPage, { ContactLine } from "@/components/LegalPage";
import { getSiteSettings } from "@/lib/site";

export const metadata: Metadata = { title: "Privacy policy" };

export default async function PrivacyPage() {
  const s = await getSiteSettings();
  const contact = <ContactLine instagramUrl={s.instagramUrl} instagramHandle={s.instagramHandle} />;
  return (
    <LegalPage title="Privacy policy" updated="October 5, 2026">
      <p>
        This explains what personal information {s.name} collects when you use this website or order coffee from us,
        why, who else sees it, and what choices you have. We keep it to what we actually need to take and deliver your
        order.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>When you order:</strong> your name, email address, phone number (optional), what you ordered, your preferred pickup date, and, for shipped orders, your shipping address.</li>
        <li><strong>Payment details:</strong> you enter these on Square&apos;s secure checkout page. We never see or store your card number.</li>
        <li><strong>Basic technical data:</strong> like any website, our hosting records standard request information (such as your IP address and browser type) in server logs for security and troubleshooting.</li>
        <li><strong>If you contact us:</strong> whatever you send us, for example by email or Instagram message.</li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To take payment, prepare and deliver your order, and send you order updates and receipts.</li>
        <li>To arrange pickup or local delivery, or to ship your coffee.</li>
        <li>To answer your questions and handle refunds or problems.</li>
        <li>To keep our records, including for taxes and accounting, and to meet legal requirements.</li>
      </ul>
      <p>We don&apos;t sell your personal information, and we don&apos;t use it for advertising or share it for others&apos; advertising.</p>

      <h2 id="storage">Cookies and browser storage</h2>
      <p>
        This site doesn&apos;t use advertising or analytics cookies, and no third-party trackers. It stores one thing
        in your browser: the contents of your shopping bag, so it&apos;s still there if you leave and come back. This
        is needed for the site to work and stays on your device. (Staff who sign in to manage the shop also get a
        sign-in cookie.) Square&apos;s checkout page, which you reach when you pay, has its own cookies under its own
        policy. If we ever add analytics or similar, we&apos;ll update this page and ask for your consent first.
      </p>

      <h2>Who we share it with</h2>
      <p>Only the companies that help us run the shop, and only what they need:</p>
      <ul>
        <li><strong>Square</strong> processes payments and sends receipts. Its handling of your data is covered by <a href="https://squareup.com/legal/privacy">Square&apos;s privacy policy</a>.</li>
        <li><strong>Our website and database hosts</strong> store the site and our order records.</li>
        <li><strong>Shipping carriers</strong> receive your name and address for orders we ship.</li>
      </ul>
      <p>We may also disclose information if the law requires it.</p>

      <h2>How long we keep it</h2>
      <p>
        We keep order records for as long as we need them for taxes, accounting and legal purposes, and for customer
        support. After that, we delete or anonymize them.
      </p>

      <h2>Your choices and rights</h2>
      <p>
        You can ask us what personal information we hold about you, to correct it, or to delete it (we may need to keep
        some order records for legal reasons). California residents have these rights under California privacy law,
        and we won&apos;t treat you differently for using them. To make a request, {contact}. We may need to confirm
        it&apos;s really you before acting on it.
      </p>

      <h2>Children</h2>
      <p>This site is meant for adults buying coffee. We don&apos;t knowingly collect information from children under 13.</p>

      <h2>Security</h2>
      <p>
        We use reputable, secure providers and keep access to order information limited. No system is perfectly
        secure, so we can&apos;t promise absolute security.
      </p>

      <h2>Changes</h2>
      <p>If we change this policy we&apos;ll update the date above, and for significant changes we&apos;ll make it prominent on the site.</p>

      <h2>Contact</h2>
      <p>Questions about this policy: {contact}.</p>
    </LegalPage>
  );
}
