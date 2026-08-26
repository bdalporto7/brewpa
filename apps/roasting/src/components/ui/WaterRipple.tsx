/** Three staggered expanding/fading rings — used next to brewing/water moments. */
export default function WaterRipple({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <circle
        cx="12"
        cy="12"
        r="4"
        className="ripple-circle"
        style={{ animationDelay: "0s" }}
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <circle
        cx="12"
        cy="12"
        r="4"
        className="ripple-circle"
        style={{ animationDelay: "0.8s" }}
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <circle
        cx="12"
        cy="12"
        r="4"
        className="ripple-circle"
        style={{ animationDelay: "1.6s" }}
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </svg>
  );
}
