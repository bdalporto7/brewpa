import crypto from "node:crypto";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

// Purely cosmetic — makes a leaked token greppable/identifiable at a
// glance, matching the convention GitHub/Stripe tokens use. The actual
// security is the 256 bits of randomness after it, not the prefix.
const TOKEN_PREFIX = "cybarsync_";

/** 256 bits of randomness — plenty to make guessing/brute-forcing infeasible; only ever stored hashed, see hashSyncToken. */
export function generateSyncToken(): string {
  return `${TOKEN_PREFIX}${crypto.randomBytes(32).toString("base64url")}`;
}

export function hashSyncToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Resolves a bearer token to the AllowedUser (and their team) it was
 * minted for. A hash-lookup, not a `timingSafeEqual` compare — unlike
 * PROBE_INGEST_TOKEN's flat env-var secret (api/probe/temperature/
 * route.ts), a random 256-bit token looked up by its own hash has no
 * in-process timing side-channel worth guarding against; the entropy is
 * the whole story. Rejects a revoked token exactly like a missing one —
 * no distinction visible to the caller. Bumps lastUsedAt so a revoked-
 * but-still-active device is visible from /admin.
 */
export async function resolveSyncToken(bearerToken: string) {
  const tokenHash = hashSyncToken(bearerToken);
  const token = await prisma.syncToken.findUnique({
    where: { tokenHash },
    include: { user: { include: { team: true } } },
  });
  if (!token || token.revokedAt) return null;

  await prisma.syncToken.update({ where: { id: token.id }, data: { lastUsedAt: new Date() } });
  return token;
}

/** Shared by every /api/sync/* route — same Bearer-header shape api/probe/temperature uses, just resolved against SyncToken instead of a flat env var. */
export async function resolveSyncRequest(request: NextRequest) {
  const header = request.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return resolveSyncToken(token);
}
