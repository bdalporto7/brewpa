"use client";

import { useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { X } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";

export default function DeleteButton({
  action,
  confirmText,
  label = "Delete",
  variant = "text",
  successMessage = "Removed",
}: {
  action: () => Promise<void>;
  confirmText: string;
  label?: string;
  /** "icon" is a compact X trigger for use inside a chip/pill, e.g. grouped event rows. */
  variant?: "text" | "icon";
  /** Pass null to skip the toast (e.g. a redirecting delete, where the navigation is itself the feedback). */
  successMessage?: string | null;
}) {
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!window.confirm(confirmText)) return;
    setError(null);
    startTransition(async () => {
      try {
        await action();
        if (successMessage) toast(successMessage);
      } catch (e) {
        unstable_rethrow(e);
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  if (variant === "icon") {
    return (
      <span className="relative inline-flex">
        <button
          type="button"
          disabled={isPending}
          onClick={handleClick}
          aria-label={label}
          className="text-muted/50 transition hover:text-danger disabled:opacity-50"
        >
          <X className="h-3 w-3" />
        </button>
        {error && (
          <span className="absolute top-full left-1/2 z-10 mt-1 w-max max-w-[10rem] -translate-x-1/2 rounded border border-danger/30 bg-surface px-1.5 py-1 text-[10px] text-danger shadow-sm">
            {error}
          </span>
        )}
      </span>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={isPending}
        onClick={handleClick}
        className="text-xs font-medium text-danger/70 transition hover:text-danger disabled:opacity-50"
      >
        {isPending ? "Deleting…" : label}
      </button>
      {error && <p className="max-w-[12rem] text-right text-xs text-danger">{error}</p>}
    </div>
  );
}
