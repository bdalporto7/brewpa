import { prisma } from "@/lib/prisma";
import RoastProfileForm from "@/components/roasts/RoastProfileForm";
import RoastProfileCard from "@/components/roasts/RoastProfileCard";

export default async function RoastProfilesPage() {
  const profiles = await prisma.roastProfile.findMany({ orderBy: [{ isFavorite: "desc" }, { name: "asc" }] });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-4xl font-black tracking-tight">Profiles</h1>
        <p className="text-sm text-muted">Save a dial schedule and targets once, apply it to any future roast.</p>
      </div>

      <div className="rounded-xl border-2 border-[var(--border-strong)] bg-surface shadow-[2px_2px_0_var(--shadow-ink)] p-4">
        <p className="mb-3 text-sm font-medium">New profile</p>
        <RoastProfileForm />
      </div>

      <div>
        <h2 className="mb-3 font-medium">All profiles</h2>
        {profiles.length === 0 ? (
          <p className="text-sm text-muted">
            No profiles yet — build one above, or save one from an AI suggestion or a completed roast.
          </p>
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
