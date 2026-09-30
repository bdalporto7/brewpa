"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { TextField } from "@/components/ui/Field";
import LotForm from "@/components/inventory/LotForm";
import { extractLotFromUrl, createLot, type SmartAddResult } from "@/lib/inventory-connector/actions";
import { toGrams } from "@/lib/inventory-connector/math";

/**
 * Smart add: paste a supplier product page URL → Claude extracts the lot
 * details → review → save. Nothing saves before the confirm step.
 */
export default function SmartAddIntake() {
  const [result, setResult] = useState<SmartAddResult | null>(null);
  const [working, setWorking] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setWorking(true);
    try {
      setResult(await extractLotFromUrl(new FormData(e.currentTarget)));
    } finally {
      setWorking(false);
    }
  }

  const fields = result?.ok ? result.fields : null;
  const weightGrams =
    fields?.weightValue != null && fields?.weightUnit != null
      ? toGrams(fields.weightValue, fields.weightUnit)
      : null;
  const orUndef = (v: string | null): string | undefined => v ?? undefined;

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <TextField
          label="Supplier product page URL"
          name="url"
          type="url"
          required
          placeholder="https://…"
        />
        <div>
          <Button type="submit" disabled={working}>
            {working ? "Reading page…" : "Look up"}
          </Button>
        </div>
        {result && !result.ok && <p className="text-sm text-danger">{result.error}</p>}
      </form>

      {fields && (
        <div className="flex flex-col gap-4">
          <Card interactive={false} className="p-4">
            <p className="text-sm">
              <span className="font-semibold">Found it.</span>
              <span className="ml-2 text-xs text-muted">Review and correct — nothing saves until you confirm.</span>
            </p>
          </Card>
          <LotForm
            initial={{
              name: orUndef(fields.name),
              origin: orUndef(fields.origin),
              producer: orUndef(fields.producer),
              process: orUndef(fields.process),
              variety: orUndef(fields.variety),
              supplier: orUndef(fields.supplier),
              weightGrams: weightGrams ?? undefined,
              purchasePrice: fields.price,
              notes: [
                fields.tastingNotes ? `Tasting notes: ${fields.tastingNotes}` : null,
                fields.altitude ? `Altitude: ${fields.altitude}` : null,
                fields.harvestYear ? `Harvest: ${fields.harvestYear}` : null,
              ]
                .filter(Boolean)
                .join("\n"),
            }}
            action={createLot}
            submitLabel="Create lot"
            successMessage="Lot created"
          />
        </div>
      )}
    </div>
  );
}
