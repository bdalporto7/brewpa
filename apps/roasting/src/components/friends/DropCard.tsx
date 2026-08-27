import Link from "next/link";
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
      <div className="rounded-xl border-2 border-[var(--border-strong)] bg-surface shadow-[2px_2px_0_var(--shadow-ink)] p-4 transition duration-200 hover:border-accent hover:-translate-y-0.5 hover:-rotate-[0.4deg]">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-medium">{drop.bean.name}</h3>
          <span className={`text-xs font-medium ${isClosed ? "text-muted" : "text-accent"}`}>
            {isClosed ? "Closed" : "Open"}
          </span>
        </div>
        <p className="mt-1 font-mono text-xs text-muted">
          {claimed}g / {total}g claimed · {drop.claims.length} {drop.claims.length === 1 ? "claim" : "claims"}
        </p>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-accent-soft">
          <div
            className="pour-fill h-full rounded-full bg-accent"
            style={
              // @ts-expect-error -- custom property consumed by the pour-fill keyframe
              { "--fill-width": `${percent}%` }
            }
          />
        </div>
        {!isClosed && remaining > 0 && <p className="mt-1.5 text-xs text-muted">{remaining}g left</p>}
      </div>
    </Link>
  );
}
