"use client";

import { useActionState, useEffect, useRef } from "react";
import { unstable_rethrow } from "next/navigation";
import type { ReactNode } from "react";

export default function ActionForm({
  action,
  children,
  className,
  onSuccess,
}: {
  action: (formData: FormData) => Promise<void>;
  children: ReactNode;
  className?: string;
  onSuccess?: () => void;
}) {
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
      onSuccess?.();
    }
    wasPending.current = isPending;
  }, [isPending, error, onSuccess]);

  return (
    <form action={formAction} className={className}>
      {children}
      {error && <p className="text-sm text-danger sm:col-span-2">{error}</p>}
    </form>
  );
}
