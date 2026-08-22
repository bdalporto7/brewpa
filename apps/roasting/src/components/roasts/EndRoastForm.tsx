"use client";

import { useState } from "react";
import { Square } from "lucide-react";
import { endRoast } from "@/lib/actions";
import { ROAST_LEVELS } from "@/lib/constants";
import ActionForm from "@/components/ActionForm";
import Button from "@/components/ui/Button";
import { TextField, SelectField } from "@/components/ui/Field";

export default function EndRoastForm({ roastSessionId }: { roastSessionId: string }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)} className="self-center">
        <Square className="h-4 w-4" /> Drop / end roast
      </Button>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="mb-3 text-sm font-medium">End this roast</p>
      <ActionForm action={endRoast.bind(null, roastSessionId)} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextField
          label="Roasted weight (g)"
          name="roastedWeightGrams"
          type="number"
          step="1"
          min="1"
          placeholder="Optional"
          mono
        />
        <SelectField label="Roast level" name="roastLevel" required defaultValue="">
          <option value="" disabled>
            Select level
          </option>
          {ROAST_LEVELS.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </SelectField>
        <SelectField label="Rating" name="rating" defaultValue="">
          <option value="">No rating</option>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {"★".repeat(n)}
            </option>
          ))}
        </SelectField>
        <div className="sm:col-span-2">
          <TextField label="Notes" name="notes" placeholder="Optional" />
        </div>
        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit">Confirm drop</Button>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      </ActionForm>
    </div>
  );
}
