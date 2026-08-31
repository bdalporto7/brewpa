"use client";

import { useState } from "react";
import { NotebookPen, Pencil, ChevronDown } from "lucide-react";
import { updateRoastNotes } from "@/lib/actions";
import ActionForm from "@/components/ActionForm";
import Button from "@/components/ui/Button";
import DeleteButton from "@/components/DeleteButton";

/**
 * The same RoastSession.notes field RoastDetailsForm edits after a roast
 * ends — this just gives it somewhere to live before and during one too, so
 * "what's the plan for this bean" doesn't have to wait until the roast is
 * already over to write down.
 *
 * collapsedByDefault (used on the live view, where the chart/sticky bars
 * are the priority and a plan you set once before starting is reference
 * material, not something being actively edited) only takes effect when
 * there's already something written — an empty plan always opens straight
 * to the editor, since collapsing "nothing" just hides the one way to add
 * it.
 *
 * hideWhenEmpty (the completed view, where most roasts never had a plan
 * written) swaps that "always open when empty" default for a minimal
 * "+ Add notes" trigger instead — most completed roasts having an
 * unprompted open textarea for something that's usually blank is exactly
 * the clutter this was meant to avoid, matching RoastDetailsForm's own
 * "collapsed until there's something to show" pattern.
 */
export default function RoastPlanCard({
  roastSessionId,
  notes,
  collapsedByDefault = false,
  hideWhenEmpty = false,
}: {
  roastSessionId: string;
  notes: string | null;
  collapsedByDefault?: boolean;
  hideWhenEmpty?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(!notes && !hideWhenEmpty);
  const [collapsed, setCollapsed] = useState(collapsedByDefault && Boolean(notes));

  async function handleDelete() {
    const formData = new FormData();
    formData.set("notes", "");
    await updateRoastNotes(roastSessionId, formData);
    setIsEditing(!hideWhenEmpty);
  }

  if (!notes && hideWhenEmpty && !isEditing) {
    return (
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        className="flex items-center gap-1 text-xs font-medium text-muted transition hover:text-foreground"
      >
        <Pencil className="h-3 w-3" /> Add notes
      </button>
    );
  }

  const canCollapse = Boolean(notes) && !isEditing;

  return (
    <div className="rounded-xl border-2 border-[var(--border-strong)] bg-surface shadow-[2px_2px_0_var(--shadow-ink)] p-4">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => canCollapse && setCollapsed((v) => !v)}
          disabled={!canCollapse}
          className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted uppercase"
        >
          <NotebookPen className="h-3.5 w-3.5" />
          Plan
          {canCollapse && (
            <ChevronDown className={`h-3 w-3 transition-transform ${collapsed ? "" : "rotate-180"}`} />
          )}
        </button>
        {!isEditing && !collapsed && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="text-muted transition hover:text-foreground"
              aria-label="Edit plan"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            {notes && (
              <DeleteButton
                action={handleDelete}
                confirmText="Delete this plan?"
                label="Delete"
                successMessage={null}
              />
            )}
          </div>
        )}
      </div>

      {collapsed ? null : isEditing ? (
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
            {(notes || hideWhenEmpty) && (
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
