"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { setDropClaimPaid, unfulfillDropClaim, deleteDropClaim, fulfillDropClaim } from "@/lib/actions";
import ActionForm from "@/components/ActionForm";
import Button from "@/components/ui/Button";
import { SelectField, TextField } from "@/components/ui/Field";
import DeleteButton from "@/components/DeleteButton";
import type { DropClaim, Friend, RoastSession, Sale } from "@prisma/client";

function PaidCheckbox({ dropId, claim }: { dropId: string; claim: DropClaim }) {
  const [isPending, startTransition] = useTransition();
  return (
    <label className="flex items-center gap-1.5 text-xs text-muted">
      <input
        type="checkbox"
        checked={claim.paid}
        disabled={isPending}
        onChange={(e) => startTransition(() => setDropClaimPaid(dropId, claim.id, e.target.checked))}
        className="accent-accent"
      />
      Paid
    </label>
  );
}

function FulfillForm({
  dropId,
  claim,
  eligibleRoasts,
  onDone,
}: {
  dropId: string;
  claim: DropClaim;
  eligibleRoasts: RoastSession[];
  onDone: () => void;
}) {
  return (
    <ActionForm
      action={fulfillDropClaim.bind(null, dropId, claim.id)}
      onSuccess={onDone}
      className="mt-2 grid grid-cols-2 gap-2 rounded-md border border-border bg-background p-2 sm:grid-cols-[1fr_auto_auto]"
    >
      <SelectField label="From roast" name="roastSessionId" required defaultValue="">
        <option value="" disabled>
          Select roast
        </option>
        {eligibleRoasts.map((roast) => (
          <option key={roast.id} value={roast.id}>
            {format(roast.startedAt ?? roast.createdAt, "MMM d, yyyy")} (
            {Math.round((roast.roastedRemainingGrams ?? 0) * 10) / 10}g left)
          </option>
        ))}
      </SelectField>
      <TextField
        label="Roasted (g)"
        name="roastedWeightGrams"
        type="number"
        step="0.1"
        min="0.1"
        required
        defaultValue={claim.gramsClaimed}
        mono
      />
      <div className="flex items-end gap-2">
        <Button type="submit" size="sm">
          Fulfill
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </ActionForm>
  );
}

export default function DropClaimRow({
  dropId,
  claim,
  eligibleRoasts,
}: {
  dropId: string;
  claim: DropClaim & { friend: Friend | null; sale: (Sale & { roastSession: RoastSession }) | null };
  eligibleRoasts: RoastSession[];
}) {
  const [isFulfilling, setIsFulfilling] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <li className="py-2 text-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <span className="font-mono">{Math.round(claim.gramsClaimed * 10) / 10}g</span>
          {claim.friend && (
            <span>
              {" "}
              —{" "}
              <Link href={`/friends/${claim.friend.id}`} className="underline hover:text-accent">
                {claim.friend.name}
              </Link>
            </span>
          )}
          {claim.price != null && <span className="text-muted"> · ${claim.price.toFixed(2)}</span>}
          <span className="text-muted"> · {format(claim.claimedAt, "MMM d")}</span>
        </div>
        <div className="flex items-center gap-3">
          <PaidCheckbox dropId={dropId} claim={claim} />
          <DeleteButton
            action={deleteDropClaim.bind(null, dropId, claim.id)}
            confirmText="Remove this claim? That grams becomes available again."
            label="Remove"
          />
        </div>
      </div>

      {claim.sale ? (
        <div className="mt-1 flex items-center justify-between gap-3 text-xs text-muted">
          <span>
            Fulfilled from {format(claim.sale.roastSession.startedAt ?? claim.sale.createdAt, "MMM d")} ·{" "}
            {Math.round(claim.sale.weightGrams * 10) / 10}g roasted
          </span>
          <button
            type="button"
            disabled={isPending}
            onClick={() => startTransition(() => unfulfillDropClaim(dropId, claim.id))}
            className="font-medium text-muted transition hover:text-foreground disabled:opacity-50"
          >
            Undo
          </button>
        </div>
      ) : isFulfilling ? (
        <FulfillForm dropId={dropId} claim={claim} eligibleRoasts={eligibleRoasts} onDone={() => setIsFulfilling(false)} />
      ) : eligibleRoasts.length > 0 ? (
        <button
          type="button"
          onClick={() => setIsFulfilling(true)}
          className="mt-1 text-xs font-medium text-muted transition hover:text-accent"
        >
          Fulfill from a roast
        </button>
      ) : (
        <p className="mt-1 text-xs text-muted">No completed roast of this bean with stock yet.</p>
      )}
    </li>
  );
}
