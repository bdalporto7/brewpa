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
 */
export { auth as proxy } from "@/auth";

export const config = {
  matcher: ["/((?!api/auth|api/probe|_next/static|_next/image|favicon.ico).*)"],
};
