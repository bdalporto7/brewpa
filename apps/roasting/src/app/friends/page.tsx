import { prisma } from "@/lib/prisma";
import FriendCard from "@/components/friends/FriendCard";
import StartDropForm from "@/components/friends/StartDropForm";
import DropCard from "@/components/friends/DropCard";
import SectionHeading from "@/components/ui/SectionHeading";

export default async function FriendsPage() {
  const [friends, beans, drops] = await Promise.all([
    prisma.friend.findMany({ include: { sales: true }, orderBy: { name: "asc" } }),
    prisma.bean.findMany({ where: { remainingGrams: { gt: 0 } }, orderBy: { name: "asc" } }),
    prisma.drop.findMany({
      include: { bean: true, claims: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const activeDrops = drops.filter((d) => !d.closedAt);
  const pastDrops = drops.filter((d) => d.closedAt);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold">Drops</h1>
        <p className="text-sm text-muted">
          Open up green coffee for friends to claim, first-come-first-serve, plus everyone who&apos;s
          ever gotten a drop.
        </p>
      </div>

      <StartDropForm beans={beans} />

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
          <p className="text-sm text-muted">
            No friends yet — they show up automatically the first time you log a drop for someone,
            on a roast or a claim.
          </p>
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
