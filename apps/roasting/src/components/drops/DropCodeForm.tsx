"use client";

import { useActionState } from "react";
import { redeemDropCode } from "@/lib/drop-actions";
import Button from "@/components/ui/Button";

async function action(_prevState: string | null, formData: FormData): Promise<string | null> {
  try {
    await redeemDropCode(formData);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : "Something went wrong.";
  }
}

export default function DropCodeForm() {
  const [error, formAction, isPending] = useActionState(action, null);

  return (
    <form action={formAction} className="flex w-full flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted" htmlFor="code">
          Drop code
        </label>
        <input
          id="code"
          name="code"
          required
          autoFocus
          autoComplete="off"
          autoCapitalize="characters"
          placeholder="XXXX-XXXX"
          className="rounded-md border border-border bg-surface px-3 py-2 text-center font-mono text-lg uppercase tracking-widest text-foreground placeholder:text-muted/50 focus:border-accent focus:outline-none"
        />
      </div>
      {error && <p className="text-center text-sm text-danger">{error}</p>}
      <Button type="submit" disabled={isPending} className="self-center">
        {isPending ? "Checking…" : "Continue"}
      </Button>
    </form>
  );
}
