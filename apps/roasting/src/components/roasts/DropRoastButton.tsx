"use client";

import { useState, useTransition } from "react";
import { Square } from "lucide-react";
import { dropRoast } from "@/lib/actions";
import Button from "@/components/ui/Button";

export default function DropRoastButton({ roastSessionId }: { roastSessionId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-center gap-2">
      <Button
        variant="secondary"
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              await dropRoast(roastSessionId);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Something went wrong.");
            }
          });
        }}
        className="self-center"
      >
        <Square className="h-4 w-4" /> {isPending ? "Dropping…" : "Drop Roast"}
      </Button>
      <p className="text-xs text-muted">Ends the roast now — weight, level, and notes come after.</p>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
