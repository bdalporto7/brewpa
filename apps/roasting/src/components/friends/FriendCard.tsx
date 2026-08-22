import Link from "next/link";
import Card from "@/components/ui/Card";
import type { Friend, Sale } from "@prisma/client";

export default function FriendCard({ friend }: { friend: Friend & { sales: Sale[] } }) {
  const totalGrams = friend.sales.reduce((sum, s) => sum + s.weightGrams, 0);
  const totalSpent = friend.sales.reduce((sum, s) => sum + (s.price ?? 0), 0);

  return (
    <Link href={`/friends/${friend.id}`}>
      <Card className="p-4 transition hover:border-accent">
        <div className="flex items-center justify-between gap-4">
          <h3 className="font-medium">{friend.name}</h3>
          <span className="font-mono text-sm text-muted">
            {friend.sales.length} drop{friend.sales.length === 1 ? "" : "s"}
          </span>
        </div>
        <p className="mt-1 font-mono text-xs text-muted">
          {totalGrams}g total{totalSpent > 0 && ` · $${totalSpent.toFixed(2)}`}
        </p>
      </Card>
    </Link>
  );
}
