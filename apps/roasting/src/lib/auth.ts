/**
 * A single shared password, not per-user accounts — the goal is keeping
 * this off the open internet now that it's deployed, not distinguishing
 * between the two people using it (nothing in the data model is scoped to
 * "which of us logged this"). Session tokens are HMAC-signed and verified
 * with the Web Crypto API (`crypto.subtle`, `btoa`/`atob`) rather than
 * Node's `crypto` module or a JWT library, since this needs to run in
 * Next.js middleware, which executes on the Edge runtime by default.
 */

export const SESSION_COOKIE = "roasting_session";
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

const encoder = new TextEncoder();

function requireAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set on the server.");
  return secret;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
}

function bytesToBase64Url(buf: ArrayBuffer): string {
  let binary = "";
  for (const byte of new Uint8Array(buf)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function createSessionToken(): Promise<string> {
  const payload = String(Date.now() + SESSION_MAX_AGE_MS);
  const key = await hmacKey(requireAuthSecret());
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return `${payload}.${bytesToBase64Url(signature)}`;
}

export async function verifySessionToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  if (!Number.isFinite(Number(payload)) || Number(payload) < Date.now()) return false;

  const key = await hmacKey(requireAuthSecret());
  const expected = bytesToBase64Url(await crypto.subtle.sign("HMAC", key, encoder.encode(payload)));
  return timingSafeEqual(expected, signature);
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
