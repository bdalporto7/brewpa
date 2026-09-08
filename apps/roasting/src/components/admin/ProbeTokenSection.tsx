"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { unstable_rethrow } from "next/navigation";
import { mintProbeToken, revokeProbeToken } from "@/lib/admin-actions";
import { useToast } from "@/components/ui/ToastProvider";
import Button from "@/components/ui/Button";
import DeleteButton from "@/components/DeleteButton";
import type { ProbeToken, Team } from "@prisma/client";

/**
 * One team's probe tokens (src/lib/probe-tokens.ts) — the credential
 * `scripts/probe_bridge.py` sends as `Authorization: Bearer <token>` to
 * /api/probe/temperature. Unlike SyncToken, nothing mints these
 * automatically at sign-in, so this is the only place one can be created.
 * The plaintext only ever exists in the moment right after minting — only
 * `tokenHash` is persisted — so it's shown once here with a copy button
 * and never again after this component unmounts/reloads.
 */
export default function ProbeTokenSection({ team }: { team: Team & { probeTokens: ProbeToken[] } }) {
  const toast = useToast();
  const [label, setLabel] = useState("");
  const [mintedToken, setMintedToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const activeTokens = team.probeTokens.filter((t) => !t.revokedAt);

  function handleMint() {
    setError(null);
    startTransition(async () => {
      try {
        const { token } = await mintProbeToken(team.id, label);
        setMintedToken(token);
        setLabel("");
      } catch (e) {
        unstable_rethrow(e);
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  async function copyMintedToken() {
    if (!mintedToken) return;
    await navigator.clipboard.writeText(mintedToken);
    toast("Token copied");
  }

  return (
    <div className="flex flex-col gap-2 py-2.5 text-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium">{team.name}</span>
      </div>

      {activeTokens.length > 0 && (
        <ul className="flex flex-col gap-1 pl-3 text-xs text-muted">
          {activeTokens.map((token) => (
            <li key={token.id} className="flex items-center justify-between gap-3">
              <span>
                {token.label ?? "Probe token"} · {token.lastUsedAt ? `last used ${format(token.lastUsedAt, "MMM d, yyyy")}` : "never used"}
              </span>
              <DeleteButton
                action={revokeProbeToken.bind(null, token.id)}
                confirmText={`Revoke "${token.label ?? "this probe token"}"? Any probe bridge script using it will stop logging readings immediately.`}
                label="Revoke"
                successMessage="Token revoked"
              />
            </li>
          ))}
        </ul>
      )}

      {mintedToken ? (
        <div className="flex flex-col gap-1.5 pl-3">
          <div className="flex items-center gap-2 rounded-md border border-border bg-surface px-2.5 py-1.5">
            <code className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">{mintedToken}</code>
            <button type="button" onClick={copyMintedToken} className="shrink-0 text-xs font-medium text-accent hover:underline">
              Copy
            </button>
          </div>
          <p className="text-xs text-muted">
            Copy this now — it won&apos;t be shown again. Set it as <code className="font-mono">PROBE_INGEST_TOKEN</code> for{" "}
            <code className="font-mono">scripts/probe_bridge.py</code>.
          </p>
          <button type="button" onClick={() => setMintedToken(null)} className="self-start text-xs text-muted hover:text-foreground">
            Done
          </button>
        </div>
      ) : (
        <div className="flex items-end gap-2 pl-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted" htmlFor={`probe-token-label-${team.id}`}>
              Label
            </label>
            <input
              id={`probe-token-label-${team.id}`}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Roastery laptop"
              className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted/70 focus:border-accent focus:outline-none"
            />
          </div>
          <Button type="button" size="sm" variant="secondary" disabled={isPending} onClick={handleMint}>
            {isPending ? "Generating…" : "Generate token"}
          </Button>
        </div>
      )}
      {error && <p className="pl-3 text-xs text-danger">{error}</p>}
    </div>
  );
}
