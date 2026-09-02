"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { MessageSquareQuote } from "lucide-react";
import type { Bean } from "@prisma/client";
import { fetchSupplierInfo, updateBeanTastingNotes, updateBeanQGrade } from "@/lib/actions";
import EditableTextCard from "@/components/ui/EditableTextCard";
import CybarMark from "@/components/ui/CybarMark";
import Button from "@/components/ui/Button";

/**
 * Tasting notes + Q-grade pulled from Bean.supplierUrl via an LLM
 * extraction (src/lib/supplierExtractor.ts) — not a guaranteed-accurate
 * scrape, so both fields stay hand-editable regardless of whether the
 * fetch worked or even ran (arbitrary supplier sites can block bots, or
 * just not have the info at all). Fetch is opt-in, never automatic.
 */
export default function SupplierTastingNotes({ bean }: { bean: Bean }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [qGradeDraft, setQGradeDraft] = useState(bean.qGrade != null ? String(bean.qGrade) : "");

  function handleFetch() {
    setError(null);
    startTransition(async () => {
      try {
        await fetchSupplierInfo(bean.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  function handleQGradeBlur() {
    const trimmed = qGradeDraft.trim();
    const parsed = trimmed ? Number(trimmed) : null;
    if (trimmed && (parsed === null || Number.isNaN(parsed) || parsed < 0 || parsed > 100)) {
      setError("Q-grade should be a number between 0 and 100.");
      return;
    }
    setError(null);
    startTransition(async () => {
      await updateBeanQGrade(bean.id, parsed);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-xs font-medium text-muted">
          Q-grade
          <input
            type="number"
            min={0}
            max={100}
            step={0.1}
            value={qGradeDraft}
            onChange={(e) => setQGradeDraft(e.target.value)}
            onBlur={handleQGradeBlur}
            placeholder="—"
            disabled={isPending}
            className="w-16 rounded-md border border-border bg-surface px-2 py-1 font-mono text-sm text-foreground focus:border-accent focus:outline-none"
          />
        </label>
        {bean.supplierUrl && (
          <Button size="sm" variant="secondary" onClick={handleFetch} disabled={isPending}>
            <CybarMark dancing={isPending} className="h-4 w-auto" />
            {isPending ? "Fetching…" : "Fetch from supplier"}
          </Button>
        )}
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}

      <EditableTextCard
        icon={<MessageSquareQuote className="h-3.5 w-3.5" />}
        label="Tasting notes"
        value={bean.tastingNotes ?? ""}
        placeholder="citrus, honey, black tea…"
        onSave={(value) => updateBeanTastingNotes(bean.id, value)}
        deleteConfirmText="Delete these tasting notes?"
        collapsible
        defaultCollapsed
        hideWhenEmpty
      />

      {bean.tastingNotesFetchedAt && (
        <p className="text-xs text-muted">
          Fetched {format(bean.tastingNotesFetchedAt, "MMM d, yyyy")} — supplier copy, not independently verified.
        </p>
      )}
    </div>
  );
}
