import crypto from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import type { Bean, Drop } from "@prisma/client";

export const DROP_UNLOCK_COOKIE = "drop_unlock";

function requireSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is required to sign drop-unlock cookies.");
  return secret;
}

/**
 * HMAC over dropId+code rather than storing/trusting a bare dropId cookie
 * — binds the cookie to the drop's *current* code, so regenerating a
 * drop's code (or closing it — checked separately in getUnlockedDrop)
 * invalidates every outstanding cookie immediately, with nothing to track
 * or revoke individually.
 */
export function signDropUnlock(dropId: string, code: string): string {
  return crypto.createHmac("sha256", requireSecret()).update(`${dropId}:${code}`).digest("base64url");
}

export async function setDropUnlockCookie(dropId: string, code: string) {
  const cookieStore = await cookies();
  cookieStore.set(DROP_UNLOCK_COOKIE, `${dropId}.${signDropUnlock(dropId, code)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/drop",
    maxAge: 60 * 60 * 24 * 30,
  });
}

/**
 * Resolves the drop this browser has already unlocked, if any. Re-checked
 * against the drop's *current* code and closedAt on every read (not just
 * decoded and trusted) — see signDropUnlock's comment for why that's the
 * entire revocation story.
 */
export async function getUnlockedDrop(): Promise<(Drop & { beans: Bean[] }) | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(DROP_UNLOCK_COOKIE)?.value;
  if (!raw) return null;

  const dotIndex = raw.indexOf(".");
  if (dotIndex === -1) return null;
  const dropId = raw.slice(0, dotIndex);
  const mac = raw.slice(dotIndex + 1);

  const drop = await prisma.drop.findUnique({
    where: { id: dropId },
    include: { beans: { orderBy: { name: "asc" } } },
  });
  if (!drop || drop.closedAt) return null;

  const expected = signDropUnlock(drop.id, drop.code);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  return drop;
}
