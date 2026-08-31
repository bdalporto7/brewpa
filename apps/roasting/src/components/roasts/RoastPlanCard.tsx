"use client";

import { NotebookPen } from "lucide-react";
import { updateRoastNotes } from "@/lib/actions";
import EditableTextCard from "@/components/ui/EditableTextCard";

/**
 * The same RoastSession.notes field RoastDetailsForm edits after a roast
 * ends — this just gives it somewhere to live before and during one too, so
 * "what's the plan for this bean" doesn't have to wait until the roast is
 * already over to write down. A thin wrapper over EditableTextCard: the
 * only thing specific to notes is the FormData-based updateRoastNotes
 * action (every other use of EditableTextCard saves a plain string).
 *
 * collapsedByDefault (the live view, where the chart/sticky bars are the
 * priority and a plan you set once before starting is reference material)
 * and hideWhenEmpty (the completed view, where most roasts never had a
 * plan written) are independent — see EditableTextCard's own doc comment.
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
  return (
    <EditableTextCard
      icon={<NotebookPen className="h-3.5 w-3.5" />}
      label="Plan"
      value={notes ?? ""}
      placeholder="Target temps, timing, what worked last time…"
      onSave={(value) => {
        const formData = new FormData();
        formData.set("notes", value);
        return updateRoastNotes(roastSessionId, formData);
      }}
      deleteConfirmText="Delete this plan?"
      collapsible
      defaultCollapsed={collapsedByDefault}
      hideWhenEmpty={hideWhenEmpty}
    />
  );
}
