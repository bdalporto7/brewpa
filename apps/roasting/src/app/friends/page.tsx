import { prisma } from "@/lib/prisma";
import FriendCard from "@/components/friends/FriendCard";

export default async function FriendsPage() {
  const friends = await prisma.friend.findMany({
    include: { sales: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Friends</h1>
        <p className="text-sm text-muted">
          Everyone who&apos;s gotten a drop, and how much they&apos;ve had.
        </p>
      </div>

      {friends.length === 0 ? (
        <p className="text-sm text-muted">
          No friends yet — they show up automatically the first time you log a drop for someone
          on a roast.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {friends.map((friend) => (
            <FriendCard key={friend.id} friend={friend} />
          ))}
        </div>
      )}
    </div>
  );
}
