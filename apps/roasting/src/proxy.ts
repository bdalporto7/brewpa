/**
 * `middleware.ts` was renamed to `proxy.ts` in Next.js 16 (the version this
 * app runs) — `middleware.ts` still works but is deprecated, so this uses
 * the current convention rather than the one Claude's training data
 * defaults to. All it does is delegate to Auth.js's `auth` export: the
 * `authorized` callback in src/auth.ts decides whether a request gets
 * through or gets redirected to `pages.signIn` ("/login").
 */
export { auth as proxy } from "@/auth";

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
