import type { ButtonHTMLAttributes } from "react";

// primary/secondary get a "stamp": the offset shadow collapses and the
// button slides into it on press, like a rubber stamp meeting paper —
// ghost/danger have no shadow to collapse into, so they stay plain.
const STAMP = "active:translate-x-[2px] active:translate-y-[2px] active:shadow-none";

const VARIANTS = {
  primary: `bg-accent text-accent-foreground border-2 border-[var(--border-strong)] shadow-[2px_2px_0_var(--shadow-ink)] hover:opacity-90 ${STAMP}`,
  secondary: `bg-accent-soft text-foreground border-2 border-[var(--border-strong)] shadow-[2px_2px_0_var(--shadow-ink)] hover:opacity-80 ${STAMP}`,
  ghost: "text-muted hover:text-foreground",
  danger: "text-danger/80 hover:text-danger",
} as const;

const SIZES = {
  sm: "px-2.5 py-1 text-xs",
  md: "px-3.5 py-2 text-sm",
  lg: "px-5 py-3 text-base",
} as const;

export default function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
}) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    />
  );
}
