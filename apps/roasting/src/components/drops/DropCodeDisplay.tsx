"use client";

import { useToast } from "@/components/ui/ToastProvider";
import { formatDropCode } from "@/lib/constants";

/**
 * No link/URL to show or copy anymore — a drop code is spoken/texted and
 * typed by hand at the one static /drop page, not clicked. Server-rendered
 * outright (no window/origin dependency the old URL version had), so
 * there's nothing here that can hydration-mismatch.
 */
export default function DropCodeDisplay({ code }: { code: string }) {
  const toast = useToast();

  async function copy() {
    await navigator.clipboard.writeText(code);
    toast("Code copied");
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2 rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm">
        <span className="min-w-0 flex-1 font-mono text-sm tracking-widest text-foreground">
          {formatDropCode(code)}
        </span>
        <button type="button" onClick={copy} className="shrink-0 text-xs font-medium text-accent hover:underline">
          Copy
        </button>
      </div>
      <p className="text-xs text-muted">Share this code — visitors enter it at /drop.</p>
    </div>
  );
}
