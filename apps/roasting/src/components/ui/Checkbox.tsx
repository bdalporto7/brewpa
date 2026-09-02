import type { InputHTMLAttributes } from "react";

/** A labeled checkbox — works both uncontrolled (inside a form, just a
 * `name`) and controlled (`checked`/`onChange`), since both show up
 * across the app's admin/claim toggles. */
export default function Checkbox({
  label,
  className = "",
  ...props
}: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={`flex items-center gap-1.5 text-xs text-muted ${className}`}>
      <input type="checkbox" className="accent-accent" {...props} />
      {label}
    </label>
  );
}
