"use client";

import { useSyncExternalStore } from "react";
import { useToast } from "@/components/ui/ToastProvider";

function subscribe() {
  return () => {};
}

function getServerOrigin() {
  return null;
}

/**
 * Builds the full URL client-side from window.location.origin rather than
 * an env var — this app already runs from more than one origin (the
 * hosted deployment, and the desktop app's own localhost:41823), so
 * there's no single "the" base URL to hardcode. Read via
 * useSyncExternalStore (server snapshot null, client snapshot the real
 * origin) rather than setState-in-an-effect: the origin never changes
 * during a session, so there's nothing to actually subscribe to, and this
 * avoids the extra render a setState-in-effect would trigger while still
 * matching the server-rendered relative-path fallback on first paint.
 */
export default function CopyDropLink({ accessToken }: { accessToken: string }) {
  const origin = useSyncExternalStore(subscribe, () => window.location.origin, getServerOrigin);
  const href = origin ? `${origin}/drop/${accessToken}` : null;
  const toast = useToast();

  async function copy() {
    if (!href) return;
    await navigator.clipboard.writeText(href);
    toast("Link copied");
  }

  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm">
      <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted">{href ?? `/drop/${accessToken}`}</span>
      <button type="button" onClick={copy} className="shrink-0 text-xs font-medium text-accent hover:underline">
        Copy
      </button>
    </div>
  );
}
