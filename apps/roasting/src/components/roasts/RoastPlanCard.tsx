"use client";

import { useState } from "react";
import { NotebookPen, Pencil } from "lucide-react";
import { updateRoastNotes } from "@/lib/actions";
import ActionForm from "@/components/ActionForm";
import Button from "@/components/ui/Button";

/**
 * The same RoastSession.notes field RoastDetailsForm edits after a roast
 * ends — this just gives it somewhere to live before and during one too, so
 * "what's the plan for this bean" doesn't have to wait until the roast is
 * already over to write down.
 */
export default function RoastPlanCard({
  roastSessionId,
  notes,
}: {
  roastSessionId: string;
  notes: string | null;
}) {
  const [isEditing, setIsEditing] = useState(!notes);

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted uppercase">
          <NotebookPen className="h-3.5 w-3.5" />
          Plan
        </p>
        {!isEditing && (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="text-muted transition hover:text-foreground"
            aria-label="Edit plan"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {isEditing ? (
        <ActionForm
          action={updateRoastNotes.bind(null, roastSessionId)}
          onSuccess={() => setIsEditing(false)}
          className="flex flex-col gap-2"
        >
          <textarea
            name="notes"
            rows={3}
            defaultValue={notes ?? ""}
            placeholder="Target temps, timing, what worked last time…"
            aria-label="Roast plan"
            className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted/70 focus:border-accent focus:outline-none"
          />
          <div className="flex gap-2">
            <Button type="submit" size="sm">
              Save
            </Button>
            {notes && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
            )}
          </div>
        </ActionForm>
      ) : (
        <p className="text-sm whitespace-pre-wrap">{notes}</p>
      )}
    </div>
  );
}
