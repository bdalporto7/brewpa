"use client";

import { useState, useTransition } from "react";
import { Star } from "lucide-react";
import { setGoldenRoast } from "@/lib/actions";

export default function GoldenRoastToggle({
  beanId,
  roastSessionId,
  isGolden,
}: {
  beanId: string;
  roastSessionId: string;
  isGolden: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    setError(null);
    startTransition(async () => {
      try {
        await setGoldenRoast(beanId, isGolden ? null : roastSessionId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={isPending}
        onClick={toggle}
        className={`flex items-center gap-1.5 text-xs font-medium transition disabled:opacity-50 ${
          isGolden ? "text-warning" : "text-muted hover:text-foreground"
        }`}
      >
        <Star className={`h-3.5 w-3.5 ${isGolden ? "fill-current" : ""}`} />
        {isGolden ? "Golden roast" : "Set as golden roast"}
      </button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
