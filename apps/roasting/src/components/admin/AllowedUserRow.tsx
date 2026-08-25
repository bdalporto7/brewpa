"use client";

import { useTransition } from "react";
import { format } from "date-fns";
import { setAllowedUserAdmin, removeAllowedUser } from "@/lib/admin-actions";
import DeleteButton from "@/components/DeleteButton";
import type { AllowedUser } from "@prisma/client";

export default function AllowedUserRow({ user, isSelf }: { user: AllowedUser; isSelf: boolean }) {
  const [isPending, startTransition] = useTransition();

  return (
    <li className="flex items-center justify-between gap-3 py-2.5 text-sm">
      <div>
        <span>
          {user.email}
          {isSelf && <span className="ml-1.5 text-xs text-muted">(you)</span>}
        </span>
        <p className="text-xs text-muted">Added {format(user.createdAt, "MMM d, yyyy")}</p>
      </div>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1.5 text-xs text-muted">
          <input
            type="checkbox"
            checked={user.isAdmin}
            disabled={isPending}
            onChange={(e) => startTransition(() => setAllowedUserAdmin(user.id, e.target.checked))}
            className="accent-accent"
          />
          Admin
        </label>
        <DeleteButton
          action={removeAllowedUser.bind(null, user.id)}
          confirmText={`Remove ${user.email}? They won't be able to sign in anymore.`}
          label="Remove"
        />
      </div>
    </li>
  );
}
