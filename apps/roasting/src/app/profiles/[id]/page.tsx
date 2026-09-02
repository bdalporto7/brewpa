import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatMMSS } from "@/lib/format";
import RoastProfileDetailsPanel from "@/components/roasts/RoastProfileDetailsPanel";
import RoastSessionCard from "@/components/roasts/RoastSessionCard";
import type { PlanSettingChange, PlanTargets } from "@/lib/curve";
import Card from "@/components/ui/Card";
import Stat from "@/components/ui/Stat";
import Eyebrow from "@/components/ui/Eyebrow";

/**
 * `planJson` is a raw JSON string column (see schema) with no runtime
 * validation on read — the cast below just trusts that whatever
 * profile-actions.ts wrote still matches `PlanSettingChange`/`PlanTargets`.
 * If that shape ever changes, it needs a data migration alongside the type
 * change, or older saved profiles will render blank/wrong values here
 * instead of failing loudly.
 */
export default async function RoastProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await prisma.roastProfile.findUnique({ where: { id } });
  if (!profile) notFound();

  const roasts = await prisma.roastSession.findMany({
    where: { profileId: id },
    include: { bean: true },
    orderBy: { startedAt: "desc" },
  });

  const plan = JSON.parse(profile.planJson) as { settingChanges: PlanSettingChange[]; targets: PlanTargets };

  return (
    <div className="flex flex-col gap-6">
      <RoastProfileDetailsPanel profile={profile} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="1st crack"
          value={plan.targets.firstCrackSeconds != null ? formatMMSS(plan.targets.firstCrackSeconds) : "—"}
        />
        <Stat
          label="Development"
          value={plan.targets.developmentSeconds != null ? formatMMSS(plan.targets.developmentSeconds) : "—"}
        />
        <Stat label="Drop temp" value={plan.targets.dropTempF != null ? `${plan.targets.dropTempF}°F` : "—"} />
        <Stat
          label="Target weight loss"
          value={plan.targets.targetWeightLossPercent != null ? `${plan.targets.targetWeightLossPercent}%` : "—"}
        />
      </div>

      {profile.description && <p className="text-sm whitespace-pre-line text-foreground/80">{profile.description}</p>}

      <Card interactive={false} className="p-4">
        <Eyebrow className="mb-2">Dial schedule</Eyebrow>
        {plan.settingChanges.length === 0 ? (
          <p className="text-sm text-muted">No dial changes saved.</p>
        ) : (
          <ul className="flex flex-col gap-0.5 font-mono text-xs">
            {plan.settingChanges.map((c, i) => (
              <li key={i}>
                {formatMMSS(c.atSeconds)} —{" "}
                {[c.fanLevel != null ? `Fan ${c.fanLevel}` : null, c.heatLevel != null ? `Heat ${c.heatLevel}` : null]
                  .filter(Boolean)
                  .join(" / ")}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div>
        <h2 className="mb-3 font-medium">Roasts started from this profile</h2>
        {roasts.length === 0 ? (
          <p className="text-sm text-muted">No roasts have used this profile yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {roasts.map((session) => (
              <RoastSessionCard key={session.id} session={session} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
