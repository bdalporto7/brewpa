import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { ABOUT_FALLBACK } from "@/content/about";

/**
 * Site-wide settings, edited by the team on the roasting app's /shop page
 * (ShopSettings row). Falls back to these defaults until that row exists, so
 * the site always renders. Checkout charges shipping from these same values,
 * so what a customer reads is what they're charged.
 */
export interface SiteSettings {
  name: string;
  announcement: string | null;
  tagline: string;
  heroHeadline: string;
  heroBody: string;
  localSummary: string;
  noticeDays: number;
  shippingFlatCents: number;
  freeShippingOverCents: number;
  instagramUrl: string | null;
  instagramHandle: string | null;
  aboutIntro: string;
  /** Parsed About body: headings and paragraphs, in order. */
  about: { kind: "heading" | "paragraph"; text: string }[];
}

const DEFAULTS = {
  tagline: "Small-batch coffee, roasted in San Francisco",
  heroHeadline: "Small-batch coffee from a tiny roaster in San Francisco.",
  heroBody:
    "We roast a few coffees at a time, in small batches, and sell them by the bag. Pick it up or get it delivered in San Francisco, or have it shipped.",
  localSummary: "Pickup or local delivery in San Francisco",
  noticeDays: 2,
  shippingFlatCents: 600,
  freeShippingOverCents: 5000,
  instagramUrl: "https://www.instagram.com/cybarcoffee",
};

/** "## Heading" lines become headings; blank-line-separated blocks become paragraphs. */
function parseAbout(body: string): SiteSettings["about"] {
  return body
    .split(/\n\s*\n/)
    .flatMap((block) => {
      const lines = block.trim().split("\n");
      const out: SiteSettings["about"] = [];
      let para: string[] = [];
      for (const line of lines) {
        if (line.startsWith("## ")) {
          if (para.length) out.push({ kind: "paragraph", text: para.join(" ") });
          para = [];
          out.push({ kind: "heading", text: line.slice(3).trim() });
        } else if (line.trim()) {
          para.push(line.trim());
        }
      }
      if (para.length) out.push({ kind: "paragraph", text: para.join(" ") });
      return out;
    });
}

function handleFrom(url: string | null): string | null {
  const m = url?.match(/instagram\.com\/([^/?#]+)/i);
  return m ? `@${m[1]}` : null;
}

export const getSiteSettings = cache(async (): Promise<SiteSettings> => {
  const teamId = process.env.SHOP_TEAM_ID;
  const row = teamId ? await prisma.shopSettings.findUnique({ where: { teamId } }) : null;
  const instagramUrl = row ? row.instagramUrl : DEFAULTS.instagramUrl;
  return {
    name: "Cybar Coffee",
    announcement: row?.announcement ?? null,
    tagline: row?.tagline ?? DEFAULTS.tagline,
    heroHeadline: row?.heroHeadline ?? DEFAULTS.heroHeadline,
    heroBody: row?.heroBody ?? DEFAULTS.heroBody,
    localSummary: row?.localSummary ?? DEFAULTS.localSummary,
    noticeDays: row?.noticeDays ?? DEFAULTS.noticeDays,
    shippingFlatCents: row?.shippingFlatCents ?? DEFAULTS.shippingFlatCents,
    freeShippingOverCents: row?.freeShippingOverCents ?? DEFAULTS.freeShippingOverCents,
    instagramUrl,
    instagramHandle: handleFrom(instagramUrl),
    aboutIntro: row?.aboutIntro ?? ABOUT_FALLBACK.intro,
    about: row?.aboutBody ? parseAbout(row.aboutBody) : ABOUT_FALLBACK.blocks,
  };
});

export function shippingCentsFor(settings: SiteSettings, subtotalCents: number): number {
  return subtotalCents >= settings.freeShippingOverCents ? 0 : settings.shippingFlatCents;
}
