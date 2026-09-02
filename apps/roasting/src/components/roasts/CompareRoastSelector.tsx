"use client";

import { useState, useTransition } from "react";
import { setCompareRoast } from "@/lib/actions";
import { SelectField } from "@/components/ui/Field";
import Card from "@/components/ui/Card";

export default function CompareRoastSelector({
  roastSessionId,
  candidates,
  initialCompareToId,
}: {
  roastSessionId: string;
  candidates: { id: string; label: string }[];
  initialCompareToId: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (candidates.length === 0) return null;

  return (
    <Card interactive={false} className="p-4">
      <p className="mb-1 text-sm font-medium">Compare against (optional)</p>
      <p className="mb-3 text-xs text-muted">
        Pick a past roast to overlay live as you go — temp, fan/heat, and crack timing, right on the live view.
      </p>
      <div className="max-w-md">
        <SelectField
          label="Overlay roast"
          name="compareToId"
          defaultValue={initialCompareToId ?? ""}
          disabled={isPending}
          onChange={(e) => {
            setError(null);
            const value = e.target.value || null;
            startTransition(async () => {
              try {
                await setCompareRoast(roastSessionId, value);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Something went wrong.");
              }
            });
          }}
        >
          <option value="">No comparison</option>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </SelectField>
      </div>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </Card>
  );
}
