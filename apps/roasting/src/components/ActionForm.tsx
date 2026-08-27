"use client";

import { useActionState, useEffect, useRef } from "react";
import { unstable_rethrow } from "next/navigation";
import type { ReactNode } from "react";
import { useToast } from "@/components/ui/ToastProvider";

export default function ActionForm({
  action,
  children,
  className,
  onSuccess,
  successMessage = "Saved",
}: {
  action: (formData: FormData) => Promise<void>;
  children: ReactNode;
  className?: string;
  onSuccess?: () => void;
  /** Pass null to skip the toast entirely for this form (e.g. a redirecting action, where the navigation is itself the feedback). */
  successMessage?: string | null;
}) {
  const toast = useToast();
  const [error, formAction, isPending] = useActionState(async (_prev: string | null, formData: FormData) => {
    try {
      await action(formData);
      return null;
    } catch (e) {
      unstable_rethrow(e);
      return e instanceof Error ? e.message : "Something went wrong.";
    }
  }, null);

  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !isPending && error === null) {
      if (successMessage) toast(successMessage);
      onSuccess?.();
    }
    wasPending.current = isPending;
  }, [isPending, error, onSuccess, successMessage, toast]);

  return (
    <form action={formAction} className={className}>
      {children}
      {error && <p className="text-sm text-danger sm:col-span-2">{error}</p>}
    </form>
  );
}
