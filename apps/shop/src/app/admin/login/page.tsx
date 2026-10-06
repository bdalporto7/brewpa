import type { Metadata } from "next";
import { signIn } from "@/auth";

export const metadata: Metadata = { title: "Shop admin sign in", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const devLogin = process.env.SHOP_DEV_LOGIN === "1" && process.env.NODE_ENV !== "production";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const button =
    "w-full rounded-lg border-2 border-[var(--border-strong)] bg-surface px-5 py-3 font-semibold shadow-[3px_3px_0_var(--shadow-ink)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none";
  return (
    <div className="mx-auto max-w-sm px-4 pt-16">
      <h1 className="text-4xl font-extrabold tracking-tight">Shop admin</h1>
      <p className="mt-3 text-muted">Sign in with the Google or GitHub account that has access to Cybar Coffee.</p>
      {error && (
        <p role="alert" className="mt-4 rounded-lg border-2 border-accent px-3 py-2 text-sm font-semibold">
          That account isn&apos;t on the access list. Ask an admin to add your email, then try again.
        </p>
      )}
      <div className="mt-6 space-y-3">
        <form action={async () => { "use server"; await signIn("google", { redirectTo: "/admin/orders" }); }}>
          <button type="submit" className={button}>Continue with Google</button>
        </form>
        <form action={async () => { "use server"; await signIn("github", { redirectTo: "/admin/orders" }); }}>
          <button type="submit" className={button}>Continue with GitHub</button>
        </form>
        {devLogin && (
          <form action={async () => { "use server"; await signIn("dev", { redirectTo: "/admin/orders" }); }}>
            <button type="submit" className={`${button} border-dashed`}>Local test login (development only)</button>
          </form>
        )}
      </div>
    </div>
  );
}
