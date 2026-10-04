"use client";

import type { ShopSettings } from "@prisma/client";
import { saveShopSettings } from "@/lib/shop-actions";
import ActionForm from "@/components/ActionForm";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { TextField, TextareaField } from "@/components/ui/Field";

/** Defaults mirror the ShopSettings column defaults, for the first save before a row exists. */
const DEFAULTS = {
  announcement: "",
  tagline: "Small-batch coffee, roasted in San Francisco",
  heroHeadline: "Small-batch coffee from a tiny roaster in San Francisco.",
  heroBody:
    "We roast a few coffees at a time, in small batches, and sell them by the bag. Pick it up or get it delivered in San Francisco, or have it shipped.",
  localSummary: "Pickup or local delivery in San Francisco",
  noticeDays: 2,
  shippingFlatCents: 600,
  freeShippingOverCents: 5000,
  instagramUrl: "https://www.instagram.com/cybarcoffee",
  aboutIntro: "",
  aboutBody: "",
};

export default function ShopSettingsForm({ settings }: { settings: ShopSettings | null }) {
  const s = { ...DEFAULTS, ...Object.fromEntries(Object.entries(settings ?? {}).filter(([, v]) => v != null)) };

  return (
    <Card interactive={false} className="p-4">
      <ActionForm action={saveShopSettings} successMessage="Shop settings saved" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <TextField
            label="Announcement banner (optional, shown on every page)"
            name="announcement"
            defaultValue={s.announcement ?? ""}
            placeholder="This week's roasts went out Sep 22. Next roast day is Saturday."
          />
        </div>

        <fieldset className="contents">
          <legend className="sr-only">Homepage</legend>
          <div className="sm:col-span-2">
            <TextField label="Homepage headline" name="heroHeadline" defaultValue={s.heroHeadline} required />
          </div>
          <div className="sm:col-span-2">
            <TextareaField label="Homepage intro" name="heroBody" rows={3} defaultValue={s.heroBody} required />
          </div>
          <TextField label="Tagline (footer and browser tab)" name="tagline" defaultValue={s.tagline} required />
          <TextField label="Instagram link" name="instagramUrl" type="url" defaultValue={s.instagramUrl ?? ""} />
        </fieldset>

        <fieldset className="contents">
          <legend className="sr-only">Ordering</legend>
          <div className="sm:col-span-2">
            <TextField label="Local pickup/delivery line" name="localSummary" defaultValue={s.localSummary} required />
          </div>
          <TextField
            label="Roast-to-order notice (days)"
            name="noticeDays"
            type="number"
            min={0}
            max={30}
            step={1}
            defaultValue={s.noticeDays}
            mono
          />
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Shipping price ($)"
              name="shippingFlat"
              type="number"
              min={0}
              step={0.01}
              defaultValue={(s.shippingFlatCents / 100).toFixed(2)}
              mono
            />
            <TextField
              label="Free shipping over ($)"
              name="freeShippingOver"
              type="number"
              min={0}
              step={0.01}
              defaultValue={(s.freeShippingOverCents / 100).toFixed(2)}
              mono
            />
          </div>
        </fieldset>

        <fieldset className="contents">
          <legend className="sr-only">About page</legend>
          <div className="sm:col-span-2">
            <TextareaField
              label="About page intro"
              name="aboutIntro"
              rows={2}
              defaultValue={s.aboutIntro ?? ""}
              placeholder="Cybar Coffee is a tiny roaster in San Francisco…"
            />
          </div>
          <div className="sm:col-span-2">
            <TextareaField
              label="About page story (blank line between paragraphs; start a line with ## for a heading)"
              name="aboutBody"
              rows={8}
              defaultValue={s.aboutBody ?? ""}
              placeholder={"## How it started\nWrite your story here…"}
            />
          </div>
        </fieldset>

        <div className="sm:col-span-2">
          <Button type="submit">Save shop settings</Button>
        </div>
      </ActionForm>
    </Card>
  );
}
