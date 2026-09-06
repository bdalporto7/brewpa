"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import { authorizeDesktopPairing } from "@/lib/desktop-pair-actions";

/**
 * Authorizing only on an explicit click — not automatically the moment
 * this page loads — is the actual security boundary here, not a UX nicety:
 * without it, any page that could get someone to load this URL while
 * they're already signed in on roasting-three.vercel.app (an <img> tag, an
 * auto-navigating redirect) could silently mint a token and hand it to
 * whatever's registered for cybarcoffee:// on their machine. A visible
 * confirmation with the team name on it is the same mitigation GitHub's
 * own OAuth authorize screen uses.
 *
 * Navigates via `window.location.href` rather than trusting a server
 * redirect to a `cybarcoffee://` URL — some browsers only honor a
 * navigation to a non-http(s) scheme when it's directly attributable to a
 * user gesture, and a `Location` header from an awaited server action
 * doesn't reliably count even though it originated from this same click.
 */
export default function PairingConfirm({
  state,
  label,
  email,
  teamName,
}: {
  state?: string;
  label?: string;
  email: string;
  teamName: string;
}) {
  const [status, setStatus] = useState<"idle" | "pending" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  if (!state) {
    return (
      <p className="text-sm text-muted">
        This link is missing some information and can&apos;t be used to pair a desktop app. Open this page from the
        desktop app&apos;s &quot;Sign in to sync&quot; button instead of visiting it directly.
      </p>
    );
  }

  async function handleAuthorize() {
    setStatus("pending");
    setError(null);
    try {
      const { deepLink } = await authorizeDesktopPairing(state!, label ?? "");
      setStatus("done");
      window.location.href = deepLink;
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  if (status === "done") {
    return (
      <p className="text-sm text-muted">
        Signed in. If Cybar Coffee didn&apos;t open automatically, switch to it now — it&apos;ll finish setting up
        sync on its own.
      </p>
    );
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold">Pair this desktop app?</h1>
        <p className="text-sm text-muted">
          Signed in as <span className="font-medium text-foreground">{email}</span>. This will let the desktop app
          it&apos;s waiting on sync <span className="font-medium text-foreground">{teamName}</span>&apos;s data.
        </p>
      </div>
      <Button type="button" onClick={handleAuthorize} disabled={status === "pending"} className="w-full justify-center">
        {status === "pending" ? "Authorizing…" : "Authorize"}
      </Button>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
