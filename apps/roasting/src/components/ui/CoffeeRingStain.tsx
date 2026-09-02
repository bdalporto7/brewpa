/** A faint, slightly imperfect coffee-cup ring stain — decorative background texture for empty states. */
export default function CoffeeRingStain({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 140 140" className={className} fill="none" aria-hidden="true" style={{ filter: "url(#sketchy)" }}>
      <ellipse cx="70" cy="70" rx="52" ry="49" stroke="var(--brand)" strokeWidth="3.5" opacity="0.14" />
      <ellipse cx="80" cy="63" rx="42" ry="40" stroke="var(--brand)" strokeWidth="2.5" opacity="0.12" />
      <ellipse cx="60" cy="78" rx="22" ry="20" stroke="var(--brand)" strokeWidth="2" opacity="0.1" />
    </svg>
  );
}
