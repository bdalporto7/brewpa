"use client";

import { addCuppingNote, updateCuppingNote } from "@/lib/actions";
import ActionForm from "@/components/ActionForm";
import Button from "@/components/ui/Button";
import { TextField, TextareaField } from "@/components/ui/Field";
import type { CuppingNote } from "@prisma/client";

const DETAIL_FIELDS: { name: string; label: string; min: string; max?: string }[] = [
  { name: "fragranceAroma", label: "Fragrance/Aroma", min: "6", max: "10" },
  { name: "flavor", label: "Flavor", min: "6", max: "10" },
  { name: "aftertaste", label: "Aftertaste", min: "6", max: "10" },
  { name: "acidity", label: "Acidity", min: "6", max: "10" },
  { name: "body", label: "Body", min: "6", max: "10" },
  { name: "balance", label: "Balance", min: "6", max: "10" },
  { name: "uniformity", label: "Uniformity", min: "0", max: "10" },
  { name: "cleanCup", label: "Clean Cup", min: "0", max: "10" },
  { name: "sweetness", label: "Sweetness", min: "0", max: "10" },
  { name: "defects", label: "Defects", min: "0" },
];

/**
 * Add/edit form for one cupping session. Notes + Overall are the only
 * always-visible fields — "just add basic notes and score" is meant to be
 * the fast, complete path. The other 9 Q-grading categories live behind a
 * native <details> disclosure (open by default only if one of them already
 * has a value, e.g. when editing) so filling them in is possible but never
 * required.
 */
export default function CuppingNoteForm({
  roastSessionId,
  note,
  onDone,
}: {
  roastSessionId: string;
  note?: CuppingNote;
  onDone?: () => void;
}) {
  const hasDetailScores =
    note != null && DETAIL_FIELDS.some((f) => note[f.name as keyof CuppingNote] != null);
  const action = note ? updateCuppingNote.bind(null, note.id) : addCuppingNote.bind(null, roastSessionId);

  return (
    <ActionForm action={action} onSuccess={onDone} className="flex flex-col gap-3">
      {!note && (
        <TextField
          label="Cupped on"
          name="cuppedAt"
          type="date"
          defaultValue={new Date().toISOString().slice(0, 10)}
        />
      )}
      <TextareaField
        label="Notes"
        name="notes"
        rows={3}
        defaultValue={note?.notes ?? ""}
        placeholder="Tasting notes, descriptors, anything worth remembering…"
      />
      <div className="max-w-[10rem]">
        <TextField
          label="Overall (6-10)"
          name="overall"
          type="number"
          step="0.25"
          min="6"
          max="10"
          defaultValue={note?.overall ?? ""}
          mono
        />
      </div>

      <details className="rounded-md border border-border" open={hasDetailScores}>
        <summary className="cursor-pointer px-3 py-2 text-xs font-medium tracking-wide text-muted uppercase">
          Full Q-grading breakdown (optional)
        </summary>
        <div className="grid grid-cols-2 gap-3 p-3 pt-0 sm:grid-cols-3">
          {DETAIL_FIELDS.map((f) => (
            <TextField
              key={f.name}
              label={f.label}
              name={f.name}
              type="number"
              step="0.25"
              min={f.min}
              max={f.max}
              defaultValue={note?.[f.name as keyof CuppingNote] as number | undefined ?? ""}
              mono
            />
          ))}
        </div>
      </details>

      <div className="flex gap-2">
        <Button type="submit" size="sm">
          {note ? "Save" : "Add cupping note"}
        </Button>
        {onDone && (
          <Button type="button" variant="ghost" size="sm" onClick={onDone}>
            Cancel
          </Button>
        )}
      </div>
    </ActionForm>
  );
}
