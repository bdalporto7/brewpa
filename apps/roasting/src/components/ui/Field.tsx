import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

const fieldClass =
  "rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted/70 focus:border-accent focus:outline-none";

function Label({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <label className="text-xs font-medium text-muted" htmlFor={htmlFor}>
      {children}
    </label>
  );
}

export function TextField({
  label,
  name,
  mono,
  ...props
}: { label: string; name: string; mono?: boolean } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={name}>{label}</Label>
      <input id={name} name={name} className={`${fieldClass} ${mono ? "font-mono" : ""}`} {...props} />
    </div>
  );
}

export function SelectField({
  label,
  name,
  children,
  ...props
}: { label: string; name: string; children: ReactNode } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={name}>{label}</Label>
      <select id={name} name={name} className={fieldClass} {...props}>
        {children}
      </select>
    </div>
  );
}

export function TextareaField({
  label,
  name,
  ...props
}: { label: string; name: string } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={name}>{label}</Label>
      <textarea id={name} name={name} className={fieldClass} {...props} />
    </div>
  );
}
