import { signInWithGitHub, signInWithGoogle } from "@/lib/auth-actions";
import Button from "@/components/ui/Button";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  const { callbackUrl } = await searchParams;
  // Only ever a relative in-app path in practice (the proxy's own redirect,
  // or /desktop/pair's own link back to itself after a bounce) — falling
  // back to "/" for anything else, including a stray absolute URL, keeps
  // this from ever being turned into an open redirect.
  const redirectTo = callbackUrl?.startsWith("/") ? callbackUrl : "/";

  return (
    <div className="mx-auto flex max-w-xs flex-col items-center gap-6 pt-24">
      {/* eslint-disable-next-line @next/next/no-img-element -- static local asset, next/image's optimizer fails to decode this specific file */}
      <img src="/cybar-stamp.png" alt="Cybar Coffee" className="w-48" />
      <div className="flex w-full flex-col gap-3">
        <form action={signInWithGitHub.bind(null, redirectTo)}>
          <Button type="submit" className="w-full justify-center">
            Continue with GitHub
          </Button>
        </form>
        <form action={signInWithGoogle.bind(null, redirectTo)}>
          <Button type="submit" variant="secondary" className="w-full justify-center">
            Continue with Google
          </Button>
        </form>
      </div>
      <p className="text-center text-xs text-muted">Access is limited to invited accounts.</p>
    </div>
  );
}
