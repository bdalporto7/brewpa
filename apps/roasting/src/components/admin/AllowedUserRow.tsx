"use client";

import { useTransition } from "react";
import { format } from "date-fns";
import { setAllowedUserAdmin, removeAllowedUser, revokeSyncToken } from "@/lib/admin-actions";
import DeleteButton from "@/components/DeleteButton";
import Checkbox from "@/components/ui/Checkbox";
import type { AllowedUser, Team, SyncToken } from "@prisma/client";

export default function AllowedUserRow({
  user,
  isSelf,
}: {
  user: AllowedUser & { team: Team; syncTokens: SyncToken[] };
  isSelf: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const activeTokens = user.syncTokens.filter((t) => !t.revokedAt);

  return (
    <li className="flex flex-col gap-2 py-2.5 text-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <span>
            {user.email}
            {isSelf && <span className="ml-1.5 text-xs text-muted">(you)</span>}
          </span>
          <p className="text-xs text-muted">
            {user.team.name} · Added {format(user.createdAt, "MMM d, yyyy")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Checkbox
            label="Admin"
            checked={user.isAdmin}
            disabled={isPending}
            onChange={(e) => startTransition(() => setAllowedUserAdmin(user.id, e.target.checked))}
          />
          <DeleteButton
            action={removeAllowedUser.bind(null, user.id)}
            confirmText={`Remove ${user.email}? They won't be able to sign in anymore.`}
            label="Remove"
          />
        </div>
      </div>

      {/* Every desktop install that's ever signed in as this person gets its
          own standing credential to pull/push this team's data — worth
          seeing and individually cutting off (a lost laptop) without
          having to remove the person's whole account to do it. */}
      {activeTokens.length > 0 && (
        <ul className="flex flex-col gap-1 pl-3 text-xs text-muted">
          {activeTokens.map((token) => (
            <li key={token.id} className="flex items-center justify-between gap-3">
              <span>
                {token.label ?? "Sync token"} · {token.lastUsedAt ? `last used ${format(token.lastUsedAt, "MMM d, yyyy")}` : "never used"}
              </span>
              <DeleteButton
                action={revokeSyncToken.bind(null, token.id)}
                confirmText={`Revoke "${token.label ?? "this sync token"}"? That device will stop syncing immediately.`}
                label="Revoke"
                successMessage="Token revoked"
              />
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
