"use client";

import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import TapCircleLink from "@/components/ui/TapCircleLink";
import type { Friend, Sale } from "@prisma/client";

export default function FriendCard({ friend }: { friend: Friend & { sales: Sale[] } }) {
  const router = useRouter();
  const totalGrams = Math.round(friend.sales.reduce((sum, s) => sum + s.weightGrams, 0) * 10) / 10;
  const totalSpent = friend.sales.reduce((sum, s) => sum + (s.price ?? 0), 0);

  return (
    // router.push, not a wrapping <Link> — TapCircleLink on the name
    // already renders a real anchor; see RoastSessionCard for the reasoning.
    <Card
      className="cursor-pointer p-4 transition hover:border-accent"
      onClick={() => router.push(`/friends/${friend.id}`)}
    >
      <div className="flex items-center justify-between gap-4">
        <h3 className="font-medium" onClick={(e) => e.stopPropagation()}>
          <TapCircleLink href={`/friends/${friend.id}`}>{friend.name}</TapCircleLink>
        </h3>
        <span className="font-mono text-sm text-muted">
          {friend.sales.length} drop{friend.sales.length === 1 ? "" : "s"}
        </span>
      </div>
      <p className="mt-1 font-mono text-xs text-muted">
        {totalGrams}g total{totalSpent > 0 && ` · $${totalSpent.toFixed(2)}`}
      </p>
    </Card>
  );
}
