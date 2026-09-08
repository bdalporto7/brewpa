import crypto from "node:crypto";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

// Purely cosmetic, same reasoning as sync-tokens.ts's TOKEN_PREFIX — just a
// different prefix so a leaked probe token is distinguishable from a leaked
// sync token at a glance.
const TOKEN_PREFIX = "cybarprobe_";

/** 256 bits of randomness — only ever stored hashed, see hashProbeToken. */
export function generateProbeToken(): string {
  return `${TOKEN_PREFIX}${crypto.randomBytes(32).toString("base64url")}`;
}

export function hashProbeToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Resolves a bearer token to the ProbeToken (and its team) it was minted
 * for. Same hash-lookup reasoning as resolveSyncToken — a random 256-bit
 * token looked up by its own hash has no timing side-channel worth
 * guarding against, unlike PROBE_INGEST_TOKEN's old flat env-var secret
 * which needed a `timingSafeEqual` compare. Rejects a revoked token
 * exactly like a missing one. Bumps lastUsedAt so a revoked-but-still-
 * active bridge script is visible from /admin.
 */
export async function resolveProbeToken(bearerToken: string) {
  const tokenHash = hashProbeToken(bearerToken);
  const token = await prisma.probeToken.findUnique({ where: { tokenHash } });
  if (!token || token.revokedAt) return null;

  await prisma.probeToken.update({ where: { id: token.id }, data: { lastUsedAt: new Date() } });
  return token;
}

/** Same Bearer-header shape resolveSyncRequest uses, just resolved against ProbeToken instead of SyncToken. */
export async function resolveProbeRequest(request: NextRequest) {
  const header = request.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return resolveProbeToken(token);
}
