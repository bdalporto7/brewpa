"use client";

import { useState } from "react";
import { Pencil, Merge } from "lucide-react";
import { deleteFriend, mergeFriend } from "@/lib/actions";
import DeleteButton from "@/components/DeleteButton";
import FriendEditForm from "@/components/friends/FriendEditForm";
import ActionForm from "@/components/ActionForm";
import Button from "@/components/ui/Button";
import { SelectField } from "@/components/ui/Field";
import Card from "@/components/ui/Card";
import type { Friend } from "@prisma/client";

function MergeForm({ friend, otherFriends, onDone }: { friend: Friend; otherFriends: Friend[]; onDone: () => void }) {
  return (
    <Card interactive={false} className="p-4">
      <p className="mb-1 text-sm font-medium">Merge {friend.name} into…</p>
      <p className="mb-3 text-xs text-muted">
        Every drop {friend.name} has ever gotten moves to whoever you pick, then {friend.name} is deleted. Can&apos;t
        be undone.
      </p>
      <ActionForm
        action={mergeFriend.bind(null, friend.id)}
        successMessage={null}
        className="flex flex-wrap items-end gap-3"
      >
        <SelectField label="Merge into" name="targetId" required defaultValue="">
          <option value="" disabled>
            Select a friend
          </option>
          {otherFriends.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </SelectField>
        <Button type="submit" variant="danger" size="sm">
          Merge
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
      </ActionForm>
    </Card>
  );
}

export default function FriendHeader({ friend, otherFriends }: { friend: Friend; otherFriends: Friend[] }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isMerging, setIsMerging] = useState(false);

  if (isEditing) {
    return <FriendEditForm friend={friend} onDone={() => setIsEditing(false)} />;
  }

  if (isMerging) {
    return <MergeForm friend={friend} otherFriends={otherFriends} onDone={() => setIsMerging(false)} />;
  }

  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-4xl font-black tracking-tight">{friend.name}</h1>
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
        {otherFriends.length > 0 && (
          <button
            type="button"
            onClick={() => setIsMerging(true)}
            className="flex items-center gap-1 text-xs font-medium text-muted transition hover:text-foreground"
          >
            <Merge className="h-3 w-3" /> Merge
          </button>
        )}
        <DeleteButton
          action={deleteFriend.bind(null, friend.id)}
          confirmText={`Delete ${friend.name}? Their past drops stay on each roast but will show as anonymous.`}
        />
      </div>
    </div>
  );
}
