import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import RoastProfileForm from "@/components/roasts/RoastProfileForm";
import RoastProfileCard from "@/components/roasts/RoastProfileCard";
import SectionHeading from "@/components/ui/SectionHeading";
import DecoratedEmptyState from "@/components/ui/DecoratedEmptyState";
import PageStamp from "@/components/ui/PageStamp";

export default async function RoastProfilesPage() {
  const profiles = await prisma.roastProfile.findMany({ orderBy: [{ isFavorite: "desc" }, { name: "asc" }] });

  return (
    <div className="flex flex-col gap-8">
      <div className="relative">
        <PageStamp />
        <h1 className="text-4xl font-black tracking-tight">Profiles</h1>
        <p className="text-sm text-muted">Save a dial schedule and targets once, apply it to any future roast.</p>
      </div>

      {/* Closed by default — built once, reused many times via the profile
          picker, not something checked every visit (same reasoning as
          BeanForm/LogPastRoastForm's native <details>). */}
      <details className="group rounded-xl border-2 border-[var(--border-strong)] bg-surface shadow-[2px_2px_0_var(--shadow-ink)]">
        <summary className="flex cursor-pointer items-center gap-1.5 px-4 py-3 text-sm font-medium group-open:border-b group-open:border-border">
          <Plus className="h-4 w-4" /> New profile
        </summary>
        <div className="p-4">
          <RoastProfileForm />
        </div>
      </details>

      <div>
        <div className="mb-3">
          <SectionHeading>All profiles</SectionHeading>
        </div>
        {profiles.length === 0 ? (
          <DecoratedEmptyState>
            No profiles yet — build one above, or save one from an AI suggestion or a completed roast.
          </DecoratedEmptyState>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {profiles.map((profile) => (
              <RoastProfileCard key={profile.id} profile={profile} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
