import { addDropClaim } from "@/lib/actions";
import ActionForm from "@/components/ActionForm";
import Button from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import Card from "@/components/ui/Card";
import Eyebrow from "@/components/ui/Eyebrow";
import DropClaimRow from "@/components/friends/DropClaimRow";
import type { Drop, DropClaim, Friend, RoastSession, Sale } from "@prisma/client";

/**
 * `key={remainingGrams}` remounts the claim form after every successful
 * claim. Nothing here ever calls `form.reset()`, and the fields are
 * uncontrolled, so without forcing a fresh mount whatever weight/friend/
 * price someone just typed would still be sitting in the inputs for the
 * next claim.
 */
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
    <Card interactive={false} className="p-4">
      <Eyebrow className="mb-3">Claims</Eyebrow>

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
          <div>
            <TextField label="Friend" name="friendName" list="friends-list" placeholder="e.g. Jake" autoComplete="off" />
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
    </Card>
  );
}
