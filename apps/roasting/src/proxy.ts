/**
 * `middleware.ts` was renamed to `proxy.ts` in Next.js 16 (the version this
 * app runs) — `middleware.ts` still works but is deprecated, so this uses
 * the current convention rather than the one Claude's training data
 * defaults to. All it does is delegate to Auth.js's `auth` export: the
 * `authorized` callback in src/auth.ts decides whether a request gets
 * through or gets redirected to `pages.signIn` ("/login").
 *
 * `api/auth` MUST be excluded from the matcher. Without this, the OAuth
 * provider's redirect back to /api/auth/callback/[provider]?code=... gets
 * intercepted by this same proxy before NextAuth's own route handler ever
 * runs it — there's no session yet at that exact moment (creating one is
 * the whole point of that request), so `authorized` correctly says no and
 * bounces the request back to /login, discarding the OAuth code before it
 * can ever be exchanged for a session. Every login attempt would silently
 * fail this way — confirmed by watching the dev server logs during a real
 * attempt (GitHub's callback request logged as a GET to /login instead of
 * /api/auth/callback/github), not by inspection alone.
 *
 * `api/probe` is excluded for the opposite reason: the temperature-probe
 * ingest endpoint (src/app/api/probe/temperature/route.ts) is called by a
 * local script, not a signed-in browser, and authenticates with a bearer
 * token instead of a session cookie — `authorized` would reject it outright
 * for having no session at all.
 *
 * `api/desktop` is excluded for the same reason as api/probe: it's polled
 * by Electron's *main* process (apps/desktop/src-ts/main.ts), which has no
 * browser session/cookie jar at all, for live roast status to drive the
 * tray icon, dock badge, and milestone notifications. It's read-only and
 * only ever reachable from this same machine (the desktop app's Next
 * server binds to loopback only), so unlike api/probe it doesn't need a
 * bearer token either — see that route's own comment.
 *
 * `drop` is excluded because src/app/drop/[token]/page.tsx is the public
 * pre-order page — a real unauthenticated visitor, not signed in at all,
 * gated instead by a long random per-drop token baked into the URL itself
 * (see src/lib/drop-actions.ts's generateAccessToken). Unlike api/probe
 * and api/desktop above, this is a full *page* an outside person is meant
 * to load directly and submit a form from, not an API route with its own
 * bearer-token/localhost-only story — so this is the one route where the
 * token really is the entire access-control mechanism, and
 * submitDropOrder re-checks it server-side rather than trusting that the
 * page merely rendered.
 *
 * Anything with a file extension (the trailing `.*\..*` alternative) is
 * excluded too — public/'s brand assets (cybar-mark.png, cybar-stamp.png,
 * etc.) aren't sensitive and were never meant to require a session, but
 * without this they matched the catch-all like any other route: an
 * unauthenticated request got 307'd to /login instead of the image, so
 * `<img src="/cybar-stamp.png">` on /login itself — the one page that by
 * definition never has a session — silently rendered as a broken image
 * for every signed-out visitor. Found by actually looking at the
 * rendered login screen in the iOS build, not by inspection.
 */
export { auth as proxy } from "@/auth";

export const config = {
  matcher: ["/((?!api/auth|api/probe|api/desktop|drop|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
