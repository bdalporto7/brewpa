"use client";

import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import ProgressBar from "@/components/ui/ProgressBar";
import TapCircleLink from "@/components/ui/TapCircleLink";
import type { Bean, Drop, DropClaim } from "@prisma/client";

export default function DropCard({ drop }: { drop: Drop & { bean: Bean; claims: DropClaim[] } }) {
  const router = useRouter();
  const claimedRaw = drop.claims.reduce((sum, c) => sum + c.gramsClaimed, 0);
  const claimed = Math.round(claimedRaw * 10) / 10;
  const total = Math.round(drop.totalGrams * 10) / 10;
  const remaining = Math.max(0, Math.round((drop.totalGrams - claimedRaw) * 10) / 10);
  const percent = drop.totalGrams > 0 ? Math.min(100, (claimedRaw / drop.totalGrams) * 100) : 0;
  const isClosed = !!drop.closedAt;

  return (
    // router.push, not a wrapping <Link> — TapCircleLink on the bean name
    // already renders a real anchor; see RoastSessionCard for the reasoning.
    <Card className="cursor-pointer p-4 hover:border-accent" onClick={() => router.push(`/drops/${drop.id}`)}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-medium" onClick={(e) => e.stopPropagation()}>
          <TapCircleLink href={`/drops/${drop.id}`}>{drop.bean.name}</TapCircleLink>
        </h3>
        <span className={`text-xs font-medium ${isClosed ? "text-muted" : "text-accent"}`}>
          {isClosed ? "Closed" : "Open"}
        </span>
      </div>
      <p className="mt-1 font-mono text-xs text-muted">
        {claimed}g / {total}g claimed · {drop.claims.length} {drop.claims.length === 1 ? "claim" : "claims"}
      </p>
      <div className="mt-2">
        <ProgressBar percent={percent} />
      </div>
      {!isClosed && remaining > 0 && <p className="mt-1.5 text-xs text-muted">{remaining}g left</p>}
    </Card>
  );
}
