import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/admin";
import { saveSiteSettings } from "@/app/admin/actions";
import { getSiteSettings } from "@/lib/site";
import AdminForm from "@/components/AdminForm";

export const dynamic = "force-dynamic";

const input = "w-full rounded-lg border-2 border-border bg-surface px-3 py-2 focus-visible:border-[var(--border-strong)] focus-visible:outline-none";

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export default async function SettingsPage() {
  const user = (await getAdminUser())!;
  const [row, site] = await Promise.all([prisma.shopSettings.findUnique({ where: { teamId: user.teamId } }), getSiteSettings()]);
  const s = {
    announcement: row?.announcement ?? "",
    tagline: site.tagline,
    heroHeadline: site.heroHeadline,
    heroBody: site.heroBody,
    localSummary: site.localSummary,
    noticeDays: site.noticeDays,
    shippingFlatCents: site.shippingFlatCents,
    freeShippingOverCents: site.freeShippingOverCents,
    instagramUrl: site.instagramUrl ?? "",
    aboutIntro: row?.aboutIntro ?? "",
    aboutBody: row?.aboutBody ?? "",
  };

  return (
    <div>
      <h1 className="text-4xl font-extrabold tracking-tight">Site text</h1>
      <p className="mt-2 max-w-prose text-sm text-muted">
        The words on the shop and its ordering terms. Coffees, prices, photos and bag counts live in Square. Changes
        show on the site within about a minute.
      </p>

      <AdminForm action={saveSiteSettings} submitLabel="Save site text" className="mt-8 grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Announcement banner (optional, shown on every page)">
            <input name="announcement" defaultValue={s.announcement} placeholder="Next roast day is Saturday." className={input} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Homepage headline"><input name="heroHeadline" defaultValue={s.heroHeadline} required className={input} /></Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Homepage intro"><textarea name="heroBody" rows={3} defaultValue={s.heroBody} required className={input} /></Field>
        </div>
        <Field label="Tagline (footer and browser tab)"><input name="tagline" defaultValue={s.tagline} required className={input} /></Field>
        <Field label="Instagram link"><input name="instagramUrl" type="url" defaultValue={s.instagramUrl} className={input} /></Field>

        <div className="sm:col-span-2">
          <Field label="Local pickup or delivery line"><input name="localSummary" defaultValue={s.localSummary} required className={input} /></Field>
        </div>
        <Field label="Pickup notice (days)" hint="The earliest pickup date customers can choose.">
          <input name="noticeDays" type="number" min={0} max={30} step={1} defaultValue={s.noticeDays} className={`${input} font-mono`} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Shipping price ($)">
            <input name="shippingFlat" type="number" min={0} step={0.01} defaultValue={(s.shippingFlatCents / 100).toFixed(2)} className={`${input} font-mono`} />
          </Field>
          <Field label="Free shipping over ($)">
            <input name="freeShippingOver" type="number" min={0} step={0.01} defaultValue={(s.freeShippingOverCents / 100).toFixed(2)} className={`${input} font-mono`} />
          </Field>
        </div>

        <div className="sm:col-span-2">
          <Field label="About page intro"><textarea name="aboutIntro" rows={2} defaultValue={s.aboutIntro} className={input} /></Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="About page story" hint="Leave a blank line between paragraphs. Start a line with ## for a heading.">
            <textarea name="aboutBody" rows={9} defaultValue={s.aboutBody} placeholder={"## How it started\nWrite your story here…"} className={input} />
          </Field>
        </div>
      </AdminForm>
    </div>
  );
}
