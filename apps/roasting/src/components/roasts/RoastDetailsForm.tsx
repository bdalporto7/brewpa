"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { updateRoastDetails } from "@/lib/actions";
import { ROAST_LEVELS } from "@/lib/constants";
import ActionForm from "@/components/ActionForm";
import Button from "@/components/ui/Button";
import { TextField, SelectField, TextareaField } from "@/components/ui/Field";
import Card from "@/components/ui/Card";
import type { RoastSession } from "@prisma/client";

export default function RoastDetailsForm({ session }: { session: RoastSession }) {
  const hasDetails = session.roastLevel != null || session.roastedWeightGrams != null;
  const [isEditing, setIsEditing] = useState(!hasDetails);

  if (!isEditing) {
    return (
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        className="flex items-center gap-1 text-xs font-medium text-muted transition hover:text-foreground"
      >
        <Pencil className="h-3 w-3" /> Edit details
      </button>
    );
  }

  return (
    <Card interactive={false} className="p-4">
      <p className="mb-3 text-sm font-medium">
        {hasDetails ? "Edit roast details" : "How'd it turn out?"}
      </p>
      <ActionForm
        action={updateRoastDetails.bind(null, session.id)}
        onSuccess={() => setIsEditing(false)}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
      >
        <TextField
          label="Roasted weight (g)"
          name="roastedWeightGrams"
          type="number"
          step="0.1"
          min="0"
          placeholder="Optional"
          defaultValue={session.roastedWeightGrams ?? ""}
          mono
        />
        <SelectField label="Roast level" name="roastLevel" defaultValue={session.roastLevel ?? ""}>
          <option value="">Not set</option>
          {ROAST_LEVELS.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </SelectField>
        <SelectField label="Rating" name="rating" defaultValue={session.rating ?? ""}>
          <option value="">No rating</option>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {"★".repeat(n)}
            </option>
          ))}
        </SelectField>
        <div className="sm:col-span-2">
          <TextareaField label="Notes" name="notes" rows={2} defaultValue={session.notes ?? ""} />
        </div>
        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit" size="sm">
            Save
          </Button>
          {hasDetails && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
          )}
        </div>
      </ActionForm>
    </Card>
  );
}
