import { getSiteSettings } from "@/lib/site";

/** Shown when nothing is listed — an invitation to follow along, not a dead end. */
export default async function EmptyShelf() {
  const s = await getSiteSettings();
  return (
    <div className="rounded-lg border-2 border-dashed border-[var(--border-strong)] px-6 py-12 text-center">
      <p className="text-xl font-bold">The shelf is empty right now.</p>
      <p className="mx-auto mt-2 max-w-[44ch] text-muted">
        We&apos;re between roasts. New coffees go up here first{s.instagramUrl ? ", and we post them on Instagram" : ""}.
      </p>
      {s.instagramUrl && (
        <a href={s.instagramUrl} className="mt-5 inline-block font-medium underline underline-offset-4">
          Follow {s.instagramHandle ?? "us on Instagram"}
        </a>
      )}
    </div>
  );
}
