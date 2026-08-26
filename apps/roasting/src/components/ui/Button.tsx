import type { ButtonHTMLAttributes } from "react";

const VARIANTS = {
  primary:
    "bg-accent text-accent-foreground border-2 border-[var(--border-strong)] shadow-[2px_2px_0_var(--shadow-ink)] hover:opacity-90",
  secondary:
    "bg-accent-soft text-foreground border-2 border-[var(--border-strong)] shadow-[2px_2px_0_var(--shadow-ink)] hover:opacity-80",
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
