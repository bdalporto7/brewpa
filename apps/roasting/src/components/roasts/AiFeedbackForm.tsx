"use client";

import { useRef, useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { recordSuggestionFeedback } from "@/lib/actions";
import Button from "@/components/ui/Button";

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
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const feedbackRef = useRef<HTMLTextAreaElement>(null);

  return (
    <div className="rounded-xl border-2 border-[var(--border-strong)] bg-surface shadow-[2px_2px_0_var(--shadow-ink)] p-4">
      <span className="mb-2 flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted uppercase">
        <Sparkles className="h-3.5 w-3.5" />
        AI suggestion feedback
      </span>
      <div className="flex gap-2">
        <textarea
          ref={feedbackRef}
          defaultValue={initialFeedback ?? undefined}
          placeholder="Crack wasn't rolling, dark chaff stuck to beans, development target was too short…"
          rows={2}
          disabled={isPending}
          className="flex-1 rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none"
        />
        <Button
          size="sm"
          disabled={isPending}
          onClick={() => {
            const feedback = feedbackRef.current?.value.trim();
            if (!feedback) return;
            setSaved(false);
            startTransition(async () => {
              await recordSuggestionFeedback(roastSessionId, feedback);
              setSaved(true);
            });
          }}
        >
          {isPending ? "Saving…" : "Save"}
        </Button>
      </div>
      {saved && <p className="mt-1.5 text-xs text-accent">Saved — future suggestions for this machine will see it.</p>}
    </div>
  );
}
