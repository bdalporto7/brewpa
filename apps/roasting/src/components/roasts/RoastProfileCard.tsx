"use client";

import { useRouter } from "next/navigation";
import { Flame } from "lucide-react";
import { formatMMSS } from "@/lib/format";
import Card from "@/components/ui/Card";
import RoastProfileFavoriteToggle from "@/components/roasts/RoastProfileFavoriteToggle";
import TapCircleLink from "@/components/ui/TapCircleLink";
import type { RoastProfile } from "@prisma/client";
import type { PlanTargets } from "@/lib/curve";

/**
 * router.push, not a wrapping `<Link>` — TapCircleLink on the name already
 * renders a real anchor, and the favorite star still depends on its own
 * click handler stopping propagation so tapping it doesn't also navigate.
 */
export default function RoastProfileCard({ profile }: { profile: RoastProfile }) {
  const router = useRouter();
  const targets = (JSON.parse(profile.planJson) as { targets: PlanTargets }).targets;

  return (
    <Card
      className="cursor-pointer p-4 transition hover:border-accent"
      onClick={() => router.push(`/profiles/${profile.id}`)}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-medium">
          <Flame className="h-4 w-4 flex-none text-accent" />
          <span onClick={(e) => e.stopPropagation()}>
            <TapCircleLink href={`/profiles/${profile.id}`}>{profile.name}</TapCircleLink>
          </span>
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
  );
}
