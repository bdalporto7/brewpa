import { prisma } from "@/lib/prisma";
import FriendCard from "@/components/friends/FriendCard";
import CreateDropToggle from "@/components/drops/CreateDropToggle";
import DropCard from "@/components/friends/DropCard";
import SectionHeading from "@/components/ui/SectionHeading";
import DecoratedEmptyState from "@/components/ui/DecoratedEmptyState";
import PageStamp from "@/components/ui/PageStamp";

export default async function FriendsPage() {
  const [friends, beans, drops] = await Promise.all([
    prisma.friend.findMany({ include: { sales: true }, orderBy: { name: "asc" } }),
    prisma.bean.findMany({ where: { remainingGrams: { gt: 0 } }, orderBy: { name: "asc" } }),
    prisma.drop.findMany({
      include: { beans: true, orders: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const activeDrops = drops.filter((d) => !d.closedAt);
  const pastDrops = drops.filter((d) => d.closedAt);

  return (
    <div className="flex flex-col gap-8">
      <div className="relative">
        <PageStamp />
        <h1 className="text-4xl font-black tracking-tight">Drops</h1>
        <p className="text-sm text-muted">
          Open a curated pre-order menu and share the code — visitors enter it at /drop, then
          pick beans and a roast style, no account needed — plus everyone who&apos;s ever gotten a drop.
        </p>
      </div>

      <CreateDropToggle beans={beans} />

      {activeDrops.length > 0 && (
        <div>
          <div className="mb-3">
            <SectionHeading>Active drops</SectionHeading>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {activeDrops.map((drop) => (
              <DropCard key={drop.id} drop={drop} />
            ))}
          </div>
        </div>
      )}

      {pastDrops.length > 0 && (
        <div>
          <div className="mb-3">
            <SectionHeading>Past drops</SectionHeading>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {pastDrops.map((drop) => (
              <DropCard key={drop.id} drop={drop} />
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="mb-3">
          <SectionHeading>Friends</SectionHeading>
        </div>
        {friends.length === 0 ? (
          <DecoratedEmptyState>
            No friends yet — they show up automatically the first time you log a roast for someone, or
            someone places a pre-order.
          </DecoratedEmptyState>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {friends.map((friend) => (
              <FriendCard key={friend.id} friend={friend} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
