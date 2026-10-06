"use client";

import { useState, useTransition } from "react";

/** A form that runs a Server Action and says plainly whether it saved or what went wrong. */
export default function AdminForm({
  action,
  children,
  submitLabel = "Save",
  className = "",
}: {
  action: (formData: FormData) => Promise<void>;
  children: React.ReactNode;
  submitLabel?: string;
  className?: string;
}) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        setMessage(null);
        start(async () => {
          try {
            await action(data);
            setMessage({ ok: true, text: "Saved" });
          } catch (err) {
            setMessage({ ok: false, text: err instanceof Error ? err.message : "Something went wrong." });
          }
        });
      }}
    >
      {children}
      <div className="flex items-center gap-4 sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg border-2 border-[var(--border-strong)] bg-accent px-5 py-2.5 font-semibold text-accent-foreground shadow-[3px_3px_0_var(--shadow-ink)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none disabled:opacity-60"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
        {message && (
          <p role={message.ok ? "status" : "alert"} className={`text-sm font-semibold ${message.ok ? "" : "text-accent"}`}>
            {message.text}
          </p>
        )}
      </div>
    </form>
  );
}
