"use server";

import { requireUser } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { generateSyncToken, hashSyncToken } from "@/lib/sync-tokens";

/**
 * The hosted-side half of pairing a desktop install — see
 * apps/desktop/src-ts/main.ts's handlePairingCallback for the other half.
 * This only ever runs here, on the hosted deployment (never inside the
 * desktop app's own local Next server, which has no OAuth secrets to
 * complete a real sign-in with at all): the desktop app opens this app's
 * /desktop/pair page in the *system* browser, the person signs in and
 * clicks Authorize, and this mints a SyncToken and hands it back over a
 * `cybarcoffee://` redirect rather than the local OAuth+direct-Turso-
 * check dance auth.ts used to do. `requireUser()` is what actually gates
 * this — reaching this action at all already means someone completed real
 * OAuth and passed the AllowedUser check in auth.ts's signIn callback.
 *
 * `state` is a nonce the desktop app generated before opening the browser
 * and checks the callback against, so a stale or replayed pairing link
 * can't hand a token to a pairing attempt that isn't the one that's
 * currently waiting. Returned as data (not a server-side redirect) so the
 * caller can navigate with `window.location.href` from inside the same
 * click handler that invoked this — some browsers won't honor a
 * non-http(s) redirect that didn't originate from a direct user gesture.
 */
export async function authorizeDesktopPairing(state: string, label: string) {
  const user = await requireUser();
  const syncToken = generateSyncToken();

  await prisma.syncToken.create({
    data: {
      tokenHash: hashSyncToken(syncToken),
      label: label || `Desktop sync – ${new Date().toLocaleDateString()}`,
      userId: user.id,
    },
  });

  const deepLink = new URL("cybarcoffee://sync-callback");
  deepLink.searchParams.set("state", state);
  deepLink.searchParams.set("token", syncToken);
  deepLink.searchParams.set("email", user.email);

  return { deepLink: deepLink.toString() };
}
