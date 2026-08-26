import { addDropClaim } from "@/lib/actions";
import ActionForm from "@/components/ActionForm";
import Button from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import DropClaimRow from "@/components/friends/DropClaimRow";
import type { Drop, DropClaim, Friend, RoastSession, Sale } from "@prisma/client";

export default function DropClaimsPanel({
  drop,
  claims,
  friends,
  remainingGrams,
  eligibleRoasts,
}: {
  drop: Drop;
  claims: (DropClaim & { friend: Friend | null; sale: (Sale & { roastSession: RoastSession }) | null })[];
  friends: Friend[];
  remainingGrams: number;
  eligibleRoasts: RoastSession[];
}) {
  const isOpen = !drop.closedAt;

  return (
    <div className="rounded-xl border-2 border-[var(--border-strong)] bg-surface shadow-[2px_2px_0_var(--shadow-ink)] p-4">
      <p className="mb-3 text-xs font-medium tracking-wide text-muted uppercase">Claims</p>

      {isOpen && remainingGrams > 0 ? (
        <ActionForm
          key={remainingGrams}
          action={addDropClaim.bind(null, drop.id)}
          className="grid grid-cols-2 gap-3 sm:grid-cols-4"
        >
          <TextField
            label="Weight (g)"
            name="gramsClaimed"
            type="number"
            step="0.1"
            min="0.1"
            required
            placeholder={drop.portionGrams ? String(drop.portionGrams) : "200"}
            defaultValue={drop.portionGrams ?? undefined}
            mono
          />
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted" htmlFor="friendName">
              Friend
            </label>
            <input
              id="friendName"
              name="friendName"
              list="friends-list"
              placeholder="e.g. Jake"
              autoComplete="off"
              className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm placeholder:text-muted/70 focus:border-accent focus:outline-none"
            />
            <datalist id="friends-list">
              {friends.map((friend) => (
                <option key={friend.id} value={friend.name} />
              ))}
            </datalist>
          </div>
          <TextField label="Price ($)" name="price" type="number" step="0.01" min="0" placeholder="Optional" mono />
          <div className="flex items-end">
            <Button type="submit" size="sm">
              Claim
            </Button>
          </div>
        </ActionForm>
      ) : isOpen ? (
        <p className="text-sm text-muted">Fully claimed — nothing left to hand out.</p>
      ) : (
        <p className="text-sm text-muted">This drop is closed.</p>
      )}

      {claims.length > 0 && (
        <ul className="mt-4 flex flex-col divide-y divide-border border-t border-border">
          {claims.map((claim) => (
            <DropClaimRow key={claim.id} dropId={drop.id} claim={claim} eligibleRoasts={eligibleRoasts} />
          ))}
        </ul>
      )}
    </div>
  );
}
