"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { FileField, SelectField } from "@/components/ui/Field";
import LotForm from "@/components/inventory/LotForm";
import WeightInput from "@/components/inventory/WeightInput";
import Form from "@/components/inventory/Form";
import { scanReceipt, addStockToLot, createLot, type ReceiptExtractionResult } from "@/lib/inventory-connector/actions";
import { toGrams } from "@/lib/inventory-connector/math";

type LotOption = { id: string; name: string; remainingGrams: number };

/**
 * Receipt intake: scan a receipt photo/PDF → review the extracted fields
 * → save as a new lot, or add the weight to an existing lot. Nothing
 * except the receipt file itself is stored before the confirm step.
 */
export default function ReceiptIntake({ lots }: { lots: LotOption[] }) {
  const [result, setResult] = useState<ReceiptExtractionResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [mode, setMode] = useState<"new" | "existing">("new");

  async function onScan(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setScanning(true);
    try {
      const r = await scanReceipt(new FormData(e.currentTarget));
      setResult(r);
    } finally {
      setScanning(false);
    }
  }

  const fields = result?.ok ? result.fields : null;
  const receiptUrl = result?.ok ? result.receiptUrl : null;
  const weightGrams =
    fields?.weightValue != null && fields?.weightUnit != null
      ? toGrams(fields.weightValue, fields.weightUnit)
      : null;
  // LotForm takes Partial<Bean> — extraction nulls become undefined.
  const orUndef = (v: string | null): string | undefined => v ?? undefined;

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={onScan} className="flex flex-col gap-3">
        <FileField label="Receipt photo or PDF" name="file" accept="image/*,application/pdf" required />
        <div>
          <Button type="submit" disabled={scanning}>
            {scanning ? "Reading receipt…" : "Scan receipt"}
          </Button>
        </div>
        {result && !result.ok && <p className="text-sm text-danger">{result.error}</p>}
      </form>

      {fields && (
        <div className="flex flex-col gap-4">
          <Card interactive={false} className="p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm">
                <span className="font-semibold">Scan complete</span>
                <span className="ml-2 text-xs text-muted">confidence: {fields.confidence}</span>
              </p>
              {receiptUrl && (
                <a href={receiptUrl} target="_blank" rel="noreferrer" className="text-sm text-muted underline hover:text-foreground">
                  View receipt
                </a>
              )}
            </div>
            {fields.confidence === "low" && (
              <p className="mt-2 text-sm text-danger">Low confidence — check every field below before saving.</p>
            )}
            <p className="mt-2 text-xs text-muted">Review and correct — nothing saves until you confirm.</p>
          </Card>

          <div className="flex gap-1">
            {(["new", "existing"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  mode === m ? "bg-accent text-accent-foreground" : "text-muted hover:text-foreground"
                }`}
              >
                {m === "new" ? "New lot" : "Add to existing lot"}
              </button>
            ))}
          </div>

          {mode === "new" ? (
            <LotForm
              initial={{
                name: orUndef(fields.name),
                origin: orUndef(fields.origin),
                process: orUndef(fields.process),
                supplier: orUndef(fields.supplier),
                weightGrams: weightGrams ?? undefined,
                purchasePrice: fields.price,
              }}
              action={createLot}
              submitLabel="Create lot"
              successMessage="Lot created"
            />
          ) : (
            <Card interactive={false} className="p-4 sm:p-5">
              <Form action={addStockToLot} successMessage="Stock added" className="flex flex-col gap-4">
                <SelectField label="Lot" name="lotId" required defaultValue="">
                  <option value="" disabled>
                    Choose a lot…
                  </option>
                  {lots.map((lot) => (
                    <option key={lot.id} value={lot.id}>
                      {lot.name} ({Math.round(lot.remainingGrams)}g on hand)
                    </option>
                  ))}
                </SelectField>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <WeightInput label="Weight purchased" name="weight" required defaultGrams={weightGrams} />
                </div>
                <div>
                  <Button type="submit">Add stock</Button>
                </div>
              </Form>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
