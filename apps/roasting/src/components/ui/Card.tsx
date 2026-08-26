import type { HTMLAttributes } from "react";

export default function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-xl border-2 border-[var(--border-strong)] bg-surface shadow-[2px_2px_0_var(--shadow-ink)] transition-transform duration-200 hover:-translate-y-0.5 hover:-rotate-[0.4deg] ${className}`}
      {...props}
    />
  );
}
