/** A small falling droplet stream — used next to brewing/pouring moments (mirrors SteamWisp for roasting). */
export default function WaterPour({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 16" className={className} fill="none" aria-hidden="true">
      <circle cx="9" cy="2" r="1.1" className="drop-fall" style={{ animationDelay: "0s" }} fill="currentColor" />
      <circle cx="13" cy="2" r="1.1" className="drop-fall" style={{ animationDelay: "0.5s" }} fill="currentColor" />
      <circle cx="11" cy="2" r="1.1" className="drop-fall" style={{ animationDelay: "1s" }} fill="currentColor" />
    </svg>
  );
}
