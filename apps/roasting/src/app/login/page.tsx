import { Flame } from "lucide-react";
import { signInWithGitHub, signInWithGoogle } from "@/lib/auth-actions";
import Button from "@/components/ui/Button";

export default function LoginPage() {
  return (
    <div className="mx-auto flex max-w-xs flex-col items-center gap-6 pt-32">
      <div className="flex items-center gap-2 text-lg font-semibold tracking-tight">
        <Flame className="h-5 w-5 text-accent" />
        Roasting
      </div>
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
