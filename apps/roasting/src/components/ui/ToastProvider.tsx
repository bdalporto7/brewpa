"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

type ToastVariant = "success" | "error";
type ToastItem = { id: number; message: string; variant: ToastVariant };

const DISPLAY_MS = 3200;

const ToastContext = createContext<((message: string, variant?: ToastVariant) => void) | null>(null);

/** Fire-and-forget toast — no-op if called outside ToastProvider (e.g. in a test render). */
export function useToast() {
  const fire = useContext(ToastContext);
  return fire ?? (() => {});
}

export default function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const fire = useCallback((message: string, variant: ToastVariant = "success") => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, DISPLAY_MS);
  }, []);

  return (
    <ToastContext.Provider value={fire}>
      {children}
      {/* bottom-20 on mobile clears NavClient's fixed bottom tab bar
          (sm:hidden, so bottom-4 is right again once that bar is gone). */}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 sm:bottom-4 sm:items-end sm:pr-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="stamp-toast flex items-center gap-2 rounded-lg border-2 border-[var(--border-strong)] bg-surface px-4 py-2.5 shadow-[3px_3px_0_var(--shadow-ink)]"
          >
            <span
              className={`h-2 w-2 flex-none rounded-full ${t.variant === "error" ? "bg-danger" : "bg-accent"}`}
            />
            <p className="text-sm font-medium">{t.message}</p>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
