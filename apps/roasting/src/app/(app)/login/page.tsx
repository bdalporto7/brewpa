import { signInWithGitHub, signInWithGoogle } from "@/lib/auth-actions";
import Button from "@/components/ui/Button";

export default function LoginPage() {
  return (
    <div className="mx-auto flex max-w-xs flex-col items-center gap-6 pt-24">
      {/* eslint-disable-next-line @next/next/no-img-element -- static local asset, next/image's optimizer fails to decode this specific file */}
      <img src="/cybar-stamp.png" alt="Cybar Coffee" className="w-48" />
      <div className="flex w-full flex-col gap-3">
        <form action={signInWithGitHub}>
          <Button type="submit" className="w-full justify-center">
            Continue with GitHub
          </Button>
        </form>
        <form action={signInWithGoogle}>
          <Button type="submit" variant="secondary" className="w-full justify-center">
            Continue with Google
          </Button>
        </form>
      </div>
      <p className="text-center text-xs text-muted">Access is limited to invited accounts.</p>
    </div>
  );
}
