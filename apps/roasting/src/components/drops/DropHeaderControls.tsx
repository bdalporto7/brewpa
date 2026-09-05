"use client";

import { useState, useTransition } from "react";
import { closeDrop, reopenDrop, deleteDrop, regenerateDropLink } from "@/lib/drop-actions";
import DeleteButton from "@/components/DeleteButton";

export default function DropHeaderControls({ dropId, isClosed }: { dropId: string; isClosed: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    setError(null);
    startTransition(async () => {
      try {
        await (isClosed ? reopenDrop(dropId) : closeDrop(dropId));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  function regenerate() {
    if (!window.confirm("Regenerate the link? The old one will stop working immediately.")) return;
    setError(null);
    startTransition(async () => {
      try {
        await regenerateDropLink(dropId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        disabled={isPending}
        onClick={regenerate}
        className="text-xs font-medium text-muted transition hover:text-foreground disabled:opacity-50"
      >
        Regenerate link
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={toggle}
        className="text-xs font-medium text-muted transition hover:text-foreground disabled:opacity-50"
      >
        {isClosed ? "Reopen" : "Close drop"}
      </button>
      <DeleteButton
        action={deleteDrop.bind(null, dropId)}
        confirmText="Delete this drop? Its link stops working and every order on it is removed."
        label="Delete"
      />
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
