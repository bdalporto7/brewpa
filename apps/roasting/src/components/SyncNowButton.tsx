"use client";

import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { syncNow } from "@/lib/sync-actions";
import { useToast } from "@/components/ui/ToastProvider";

/**
 * Only rendered once this install has sync turned on (Nav.tsx gates it) —
 * pulls the latest hosted data down and pushes anything logged locally up.
 * Prisma's own connection already syncs periodically on its own
 * (syncInterval, src/lib/prisma.ts) — this is for "no, right now,"
 * same reasoning as any manual-refresh affordance next to an
 * otherwise-automatic background process.
 */
export default function SyncNowButton() {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();

  function handleSync() {
    startTransition(async () => {
      const result = await syncNow();
      if (result.ok) {
        toast("Synced.", "success");
        router.refresh();
      } else {
        toast(result.error ?? "Sync failed.", "error");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleSync}
      disabled={isPending}
      aria-label="Sync now"
      title="Sync now"
      className="flex items-center gap-1 text-panel-muted transition hover:text-panel-fg disabled:opacity-50"
    >
      <RefreshCw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
      <span className="hidden sm:inline">{isPending ? "Syncing…" : "Sync now"}</span>
    </button>
  );
}
