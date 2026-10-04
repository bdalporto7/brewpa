import type { Metadata } from "next";
import Link from "next/link";
import { getSiteSettings } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSiteSettings();
  return { title: "About", description: s.aboutIntro };
}

export default async function AboutPage() {
  const s = await getSiteSettings();
  return (
    <div className="mx-auto max-w-6xl px-4 pt-12 sm:px-6">
      <div className="grid gap-12 md:grid-cols-[1fr_minmax(0,40ch)]">
        <div>
          <h1 className="text-5xl font-extrabold tracking-tight">About {s.name.split(" ")[0]}</h1>
          <p className="mt-6 max-w-[54ch] text-2xl leading-snug">{s.aboutIntro}</p>

          <div className="mt-6 max-w-[62ch]">
            {s.about.map((b, i) =>
              b.kind === "heading" ? (
                <h2 key={i} className="mt-10 text-2xl font-bold tracking-tight">
                  {b.text}
                </h2>
              ) : (
                <p key={i} className="mt-3 text-lg leading-relaxed text-muted">
                  {b.text}
                </p>
              )
            )}
          </div>

          <div className="mt-12 flex flex-wrap gap-6">
            <Link href="/shop" className="font-semibold underline underline-offset-4">
              Shop coffee
            </Link>
            {s.instagramUrl && (
              <a href={s.instagramUrl} className="font-semibold underline underline-offset-4">
                Follow {s.instagramHandle ?? "us on Instagram"}
              </a>
            )}
          </div>
        </div>

        <aside className="kraft h-fit rounded-lg border-2 border-[var(--border-strong)] p-8 shadow-[4px_4px_0_var(--shadow-ink)]">
          <div className="rotate-1 rounded-sm border-2 border-[var(--border-strong)] bg-label p-6">
            {/* eslint-disable-next-line @next/next/no-img-element -- brand art, used as-is */}
            <img src="/cybar-stamp.png" alt={s.name} className="w-full" />
          </div>
        </aside>
      </div>
    </div>
  );
}
