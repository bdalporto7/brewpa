import { updateFriend } from "@/lib/actions";
import ActionForm from "@/components/ActionForm";
import Button from "@/components/ui/Button";
import { TextField, TextareaField } from "@/components/ui/Field";
import type { Friend } from "@prisma/client";

export default function FriendEditForm({ friend, onDone }: { friend: Friend; onDone: () => void }) {
  return (
    <ActionForm
      action={updateFriend.bind(null, friend.id)}
      onSuccess={onDone}
      className="flex flex-col gap-3"
    >
      <TextField label="Name" name="name" required defaultValue={friend.name} />
      <TextareaField label="Notes" name="notes" rows={2} defaultValue={friend.notes ?? ""} />
      <div className="flex gap-2">
        <Button type="submit" size="sm">
          Save
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </ActionForm>
  );
}
