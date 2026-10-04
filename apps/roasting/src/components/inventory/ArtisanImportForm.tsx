"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { TextField, TextareaField, FileField, SelectField } from "@/components/ui/Field";
import { useToast } from "@/components/ui/ToastProvider";
import { importArtisanRoast } from "@/lib/inventory-connector/actions";
import { ROAST_LEVELS } from "@/lib/inventory-connector/client";

type LotOption = { id: string; name: string };
type RoasterOption = { id: string; name: string; isDefault: boolean };

/**
 * Imports an Artisan .alog/.json roast file into the inventory logbook.
 * Stock is deducted from the chosen (or newly created) lot; the import
 * stays inside the inventory app — no redirect to the roasting app.
 */
export default function ArtisanImportForm({
  lots,
  roasters,
}: {
  lots: LotOption[];
  roasters: RoasterOption[];
}) {
  const toast = useToast();
  const [beanMode, setBeanMode] = useState<"existing" | "new">("existing");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaultRoasterId = roasters.find((r) => r.isDefault)?.id ?? roasters[0]?.id ?? "";

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setWorking(true);
    setError(null);
    try {
      await importArtisanRoast(new FormData(e.currentTarget));
      toast("Roast imported");
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <Card interactive={false} className="p-4 sm:p-5">
      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <FileField label="Artisan file (.alog or .json)" name="file" accept=".alog,.json" required />
        </div>

        <div className="sm:col-span-2">
          <p className="mb-1 text-xs font-medium text-muted">Lot</p>
          <div className="flex gap-4 text-sm">
            <label className="flex cursor-pointer items-center gap-1.5">
              <input
                type="radio"
                name="beanMode"
                value="existing"
                checked={beanMode === "existing"}
                onChange={() => setBeanMode("existing")}
                className="accent-[var(--accent)]"
              />
              Existing lot
            </label>
            <label className="flex cursor-pointer items-center gap-1.5">
              <input
                type="radio"
                name="beanMode"
                value="new"
                checked={beanMode === "new"}
                onChange={() => setBeanMode("new")}
                className="accent-[var(--accent)]"
              />
              New lot
            </label>
          </div>
        </div>

        {beanMode === "existing" ? (
          <SelectField label="Lot" name="beanId" required defaultValue="">
            <option value="" disabled>
              Choose a lot…
            </option>
            {lots.map((lot) => (
              <option key={lot.id} value={lot.id}>
                {lot.name}
              </option>
            ))}
          </SelectField>
        ) : (
          <>
            <TextField label="Lot name" name="newBeanName" placeholder="From the file if blank" />
            <TextField label="Origin *" name="newBeanOrigin" required />
            <TextField label="Process *" name="newBeanProcess" required />
          </>
        )}

        <SelectField label="Roaster *" name="roasterDefinitionId" required defaultValue={defaultRoasterId}>
          {roasters.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </SelectField>
        <SelectField label="Roast level *" name="roastLevel" required defaultValue="">
          <option value="" disabled>
            Select level…
          </option>
          {ROAST_LEVELS.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </SelectField>
        <TextField label="Rating (1–5)" name="rating" type="number" min="1" max="5" step="1" />
        <div className="sm:col-span-2">
          <TextareaField label="Notes" name="notes" rows={2} />
        </div>

        {error && <p className="text-sm text-danger sm:col-span-2">{error}</p>}
        <div className="sm:col-span-2">
          <Button type="submit" disabled={working}>
            {working ? "Importing…" : "Import roast"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
