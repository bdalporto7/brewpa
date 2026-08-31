"use client";

import { recordSuggestionFeedback } from "@/lib/actions";
import EditableTextCard from "@/components/ui/EditableTextCard";
import CybarMark from "@/components/ui/CybarMark";

/**
 * Feedback on an AI suggestion is only really knowable once the roast is
 * done — crack behavior, chaff, how it actually tasted — but the original
 * feedback box (AiSuggestionPanel) only rendered pre-roast. This is the
 * same recordSuggestionFeedback action, just reachable from the completed
 * view too, since that's when there's actually something worth saying.
 */
export default function AiFeedbackForm({
  roastSessionId,
  initialFeedback,
}: {
  roastSessionId: string;
  initialFeedback: string | null;
}) {
  return (
    <EditableTextCard
      icon={<CybarMark className="h-4 w-auto" />}
      label="AI suggestion feedback"
      value={initialFeedback ?? ""}
      placeholder="Crack wasn't rolling, dark chaff stuck to beans, development target was too short…"
      onSave={(value) => recordSuggestionFeedback(roastSessionId, value)}
      deleteConfirmText="Delete this feedback? Future suggestions won't see it anymore."
      collapsible
      defaultCollapsed
    />
  );
}
