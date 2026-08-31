"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { BookOpen } from "lucide-react";
import { applyRoastProfile } from "@/lib/profile-actions";
import Button from "@/components/ui/Button";

export interface ProfileOption {
  id: string;
  name: string;
  process: string | null;
  brewTarget: string | null;
}

/**
 * Applying a profile overwrites this session's live suggestion state
 * (fan/heat pre-fill, chart target overlay) — consequential enough that
 * this needs an explicit Apply button, unlike CompareRoastSelector's
 * auto-apply-on-change (which only picks a non-destructive read-only
 * overlay).
 */
export default function RoastProfilePicker({
  profiles,
  roastSessionId,
  beanProcess,
}: {
  profiles: ProfileOption[];
  roastSessionId: string;
  beanProcess: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectRef = useRef<HTMLSelectElement>(null);

  const sorted = useMemo(
    () =>
      [...profiles].sort((a, b) => {
        const aMatch = a.process === beanProcess ? 0 : 1;
        const bMatch = b.process === beanProcess ? 0 : 1;
        return aMatch - bMatch || a.name.localeCompare(b.name);
      }),
    [profiles, beanProcess]
  );

  if (sorted.length === 0) return null;

  function handleApply() {
    const profileId = selectRef.current?.value;
    if (!profileId) return;
    setError(null);
    startTransition(async () => {
      try {
        await applyRoastProfile(roastSessionId, profileId);
        setApplied(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="rounded-xl border-2 border-[var(--border-strong)] bg-surface shadow-[2px_2px_0_var(--shadow-ink)] p-4">
      <span className="mb-3 flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted uppercase">
        <BookOpen className="h-3.5 w-3.5" />
        Or apply a saved profile
      </span>
      <div className="flex gap-2">
        <select
          ref={selectRef}
          disabled={isPending}
          defaultValue={sorted[0].id}
          className="flex-1 rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none"
        >
          {sorted.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.process === beanProcess ? ` (${p.process})` : p.process ? ` — ${p.process}` : ""}
            </option>
          ))}
        </select>
        <Button onClick={handleApply} disabled={isPending} size="sm" variant="secondary">
          {isPending ? "Applying…" : "Apply"}
        </Button>
      </div>
      {applied && <p className="mt-2 text-xs font-medium text-accent">Applied — dial-in below has been pre-filled.</p>}
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}
