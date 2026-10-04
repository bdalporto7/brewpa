import type { Metadata } from "next";
import { Bricolage_Grotesque, Geist_Mono, Permanent_Marker } from "next/font/google";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { getSiteSettings } from "@/lib/site";
import "./globals.css";

const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
// Wordmark and hand-written "roasted on" stamps only — the same marker face
// the roasting app uses for its wordmark, echoing the mascot's sharpie lines.
const marker = Permanent_Marker({ variable: "--font-permanent-marker", weight: "400", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSiteSettings();
  return {
    metadataBase: new URL(process.env.SHOP_BASE_URL ?? "http://localhost:3001"),
    title: { default: `${s.name}: ${s.tagline}`, template: `%s | ${s.name}` },
    description: `${s.tagline}. ${s.localSummary}, or shipped anywhere in the US.`,
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const s = await getSiteSettings();
  return (
    <html lang="en" className={`${bricolage.variable} ${mono.variable} ${marker.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {s.announcement && (
          <p className="bg-ink-band px-4 py-2 text-center text-sm text-ink-band-fg">{s.announcement}</p>
        )}
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
