import Link from "next/link";
import Card from "@/components/ui/Card";
import ProgressBar from "@/components/ui/ProgressBar";
import type { Bean, Drop, DropClaim } from "@prisma/client";

export default function DropCard({ drop }: { drop: Drop & { bean: Bean; claims: DropClaim[] } }) {
  const claimedRaw = drop.claims.reduce((sum, c) => sum + c.gramsClaimed, 0);
  const claimed = Math.round(claimedRaw * 10) / 10;
  const total = Math.round(drop.totalGrams * 10) / 10;
  const remaining = Math.max(0, Math.round((drop.totalGrams - claimedRaw) * 10) / 10);
  const percent = drop.totalGrams > 0 ? Math.min(100, (claimedRaw / drop.totalGrams) * 100) : 0;
  const isClosed = !!drop.closedAt;

  return (
    <Link href={`/drops/${drop.id}`}>
      <Card className="p-4 hover:border-accent">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-medium">{drop.bean.name}</h3>
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
    </Link>
  );
}
