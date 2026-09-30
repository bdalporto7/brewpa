"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import { deleteLot } from "@/lib/inventory-connector/actions";
import Form from "@/components/inventory/Form";

/** Two-tap delete for a lot — the action itself refuses when roasts exist. */
export default function DeleteLotButton({ lotId, lotName }: { lotId: string; lotName: string }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button variant="danger" size="sm" onClick={() => setConfirming(true)}>
        Delete lot
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm">
        Delete <span className="font-semibold">{lotName}</span>? This can&apos;t be undone.
      </p>
      <div className="flex gap-2">
        <Form action={deleteLot.bind(null, lotId)} successMessage="Lot deleted">
          <Button type="submit" variant="danger" size="sm">
            Yes, delete
          </Button>
        </Form>
        <Button variant="secondary" size="sm" onClick={() => setConfirming(false)}>
          Keep it
        </Button>
      </div>
    </div>
  );
}
