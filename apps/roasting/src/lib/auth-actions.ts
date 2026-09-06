"use server";

import { signIn, signOut } from "@/auth";

/**
 * redirectTo defaults to "/" but the login page binds it to a real
 * destination when it got here via a `callbackUrl` query param — needed
 * for src/app/desktop/pair/page.tsx, which the proxy bounces an
 * unauthenticated visitor away from and back to only if this makes it
 * back where they actually started.
 */
export async function signInWithGitHub(redirectTo: string = "/") {
  await signIn("github", { redirectTo });
}

export async function signInWithGoogle(redirectTo: string = "/") {
  await signIn("google", { redirectTo });
}

export async function logout() {
  await signOut({ redirectTo: "/login" });
}
