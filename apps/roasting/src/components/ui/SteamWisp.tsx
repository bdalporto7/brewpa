/** Three staggered rising/fading wisps — used next to heat/roasting moments (the active-roast banner). */
export default function SteamWisp({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 16" className={className} fill="none" aria-hidden="true" style={{ filter: "url(#sketchy)" }}>
      <path
        d="M8 16c0-3 2-3 2-6s-2-3-2-6"
        className="steam-path"
        style={{ animationDelay: "0s" }}
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <path
        d="M12 16c0-3 2-3 2-6s-2-3-2-6"
        className="steam-path"
        style={{ animationDelay: "0.6s" }}
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <path
        d="M16 16c0-3 2-3 2-6s-2-3-2-6"
        className="steam-path"
        style={{ animationDelay: "1.2s" }}
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}
