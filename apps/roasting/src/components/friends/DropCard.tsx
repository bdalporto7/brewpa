"use client";

import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import TapCircleLink from "@/components/ui/TapCircleLink";
import type { Bean, Drop, DropOrder } from "@prisma/client";

export default function DropCard({ drop }: { drop: Drop & { beans: Bean[]; orders: DropOrder[] } }) {
  const router = useRouter();
  const isClosed = !!drop.closedAt;

  return (
    // router.push, not a wrapping <Link> — TapCircleLink on the name
    // already renders a real anchor; see RoastSessionCard for the reasoning.
    <Card className="cursor-pointer p-4 hover:border-accent" onClick={() => router.push(`/drops/${drop.id}`)}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-medium" onClick={(e) => e.stopPropagation()}>
          <TapCircleLink href={`/drops/${drop.id}`}>{drop.name}</TapCircleLink>
        </h3>
        <span className={`text-xs font-medium ${isClosed ? "text-muted" : "text-accent"}`}>
          {isClosed ? "Closed" : "Open"}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted">{drop.beans.map((b) => b.name).join(", ")}</p>
      <p className="mt-1.5 font-mono text-xs text-muted">
        {drop.orders.length} {drop.orders.length === 1 ? "order" : "orders"}
      </p>
    </Card>
  );
}
