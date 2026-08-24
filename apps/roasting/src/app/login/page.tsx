import { Flame } from "lucide-react";
import { login } from "@/lib/auth-actions";
import ActionForm from "@/components/ActionForm";
import Button from "@/components/ui/Button";

export default function LoginPage() {
  return (
    <div className="mx-auto flex max-w-xs flex-col items-center gap-6 pt-32">
      <div className="flex items-center gap-2 text-lg font-semibold tracking-tight">
        <Flame className="h-5 w-5 text-accent" />
        Roasting
      </div>
      <ActionForm action={login} className="flex w-full flex-col gap-3">
        <input
          type="password"
          name="password"
          placeholder="Password"
          autoFocus
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted/70 focus:border-accent focus:outline-none"
        />
        <Button type="submit" className="w-full justify-center">
          Log in
        </Button>
      </ActionForm>
    </div>
  );
}
