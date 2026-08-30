"use client";

import { useRef, useTransition } from "react";
import { NotebookPen } from "lucide-react";
import { logEvent } from "@/lib/actions";
import { useElapsedSeconds } from "@/lib/useElapsedSeconds";
import Button from "@/components/ui/Button";

/**
 * Just the note form now — fan/heat/temp/milestones moved into
 * LiveRoastBars's permanent bottom bar, so keeping a second copy of those
 * same controls here would only duplicate what's always on screen already.
 * A note is different: low-frequency enough that it doesn't need a
 * permanent slot in the action bar, but still worth a dedicated, easy-to-
 * find spot rather than being buried in EventTimeline's edit affordances.
 */
export default function EventLogPanel({
  roastSessionId,
  startedAt,
}: {
  roastSessionId: string;
  startedAt: string;
}) {
  const elapsed = useElapsedSeconds(startedAt);
  const [isPending, startTransition] = useTransition();
  const noteInputRef = useRef<HTMLInputElement>(null);

  function fire(input: Omit<Parameters<typeof logEvent>[0], "roastSessionId" | "atSeconds">) {
    startTransition(async () => {
      await logEvent({ ...input, roastSessionId, atSeconds: Math.round(elapsed) });
    });
  }

  return (
    <div className="rounded-xl border-2 border-[var(--border-strong)] bg-surface shadow-[2px_2px_0_var(--shadow-ink)] p-4">
      <span className="mb-2 flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted uppercase">
        <NotebookPen className="h-3.5 w-3.5" />
        Note
      </span>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const value = noteInputRef.current?.value.trim();
          if (!value) return;
          fire({ type: "NOTE", note: value });
          if (noteInputRef.current) noteInputRef.current.value = "";
        }}
      >
        <input
          ref={noteInputRef}
          type="text"
          placeholder="Smells nutty, slowing down…"
          className="flex-1 rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none"
        />
        <Button type="submit" size="sm" disabled={isPending}>
          Add
        </Button>
      </form>
    </div>
  );
}
