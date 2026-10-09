"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import { deleteLead } from "@/lib/inventory-connector/actions";
import Form from "@/components/inventory/Form";

/** Two-tap delete for a lead — takes its timeline and allocations with it (no stock was ever moved by them). */
export default function DeleteLeadButton({ leadId, leadName }: { leadId: string; leadName: string }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button variant="danger" size="sm" onClick={() => setConfirming(true)}>
        Delete lead
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm">
        Delete <span className="font-semibold">{leadName}</span> and its history? This can&apos;t be undone.
      </p>
      <div className="flex gap-2">
        <Form action={deleteLead.bind(null, leadId)} successMessage={null}>
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
