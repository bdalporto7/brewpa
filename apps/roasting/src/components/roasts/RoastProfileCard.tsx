import Link from "next/link";
import { Flame } from "lucide-react";
import { formatMMSS } from "@/lib/format";
import Card from "@/components/ui/Card";
import RoastProfileFavoriteToggle from "@/components/roasts/RoastProfileFavoriteToggle";
import type { RoastProfile } from "@prisma/client";
import type { PlanTargets } from "@/lib/curve";

export default function RoastProfileCard({ profile }: { profile: RoastProfile }) {
  const targets = (JSON.parse(profile.planJson) as { targets: PlanTargets }).targets;

  return (
    <Link href={`/profiles/${profile.id}`}>
      <Card className="p-4 transition hover:border-accent">
        <div className="flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 font-medium">
            <Flame className="h-4 w-4 flex-none text-accent" />
            {profile.name}
          </h3>
          <div className="flex items-center gap-2">
            {profile.process && <span className="text-xs text-muted">{profile.process}</span>}
            <RoastProfileFavoriteToggle profileId={profile.id} isFavorite={profile.isFavorite} />
          </div>
        </div>
        <p className="mt-1 font-mono text-xs text-muted">
          {targets.firstCrackSeconds != null && `1C ${formatMMSS(targets.firstCrackSeconds)}`}
          {targets.developmentSeconds != null && ` · dev ${formatMMSS(targets.developmentSeconds)}`}
          {targets.targetWeightLossPercent != null && ` · ${targets.targetWeightLossPercent}% loss`}
          {profile.brewTarget && ` · ${profile.brewTarget}`}
        </p>
      </Card>
    </Link>
  );
}
