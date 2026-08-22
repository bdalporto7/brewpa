"use client";

import { useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";

export default function DeleteButton({
  action,
  confirmText,
  label = "Delete",
}: {
  action: () => Promise<void>;
  confirmText: string;
  label?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          if (!window.confirm(confirmText)) return;
          setError(null);
          startTransition(async () => {
            try {
              await action();
            } catch (e) {
              unstable_rethrow(e);
              setError(e instanceof Error ? e.message : "Something went wrong.");
            }
          });
        }}
        className="text-xs font-medium text-danger/70 transition hover:text-danger disabled:opacity-50"
      >
        {isPending ? "Deleting…" : label}
      </button>
      {error && <p className="max-w-[12rem] text-right text-xs text-danger">{error}</p>}
    </div>
  );
}
