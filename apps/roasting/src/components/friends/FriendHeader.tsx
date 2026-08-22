"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { deleteFriend } from "@/lib/actions";
import DeleteButton from "@/components/DeleteButton";
import FriendEditForm from "@/components/friends/FriendEditForm";
import type { Friend } from "@prisma/client";

export default function FriendHeader({ friend }: { friend: Friend }) {
  const [isEditing, setIsEditing] = useState(false);

  if (isEditing) {
    return <FriendEditForm friend={friend} onDone={() => setIsEditing(false)} />;
  }

  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold">{friend.name}</h1>
        <p className="text-sm text-muted">Every drop this friend has gotten, across every roast.</p>
        {friend.notes && <p className="mt-1 text-sm text-foreground/80">{friend.notes}</p>}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="flex items-center gap-1 text-xs font-medium text-muted transition hover:text-foreground"
        >
          <Pencil className="h-3 w-3" /> Edit
        </button>
        <DeleteButton
          action={deleteFriend.bind(null, friend.id)}
          confirmText={`Delete ${friend.name}? Their past drops stay on each roast but will show as anonymous.`}
        />
      </div>
    </div>
  );
}
