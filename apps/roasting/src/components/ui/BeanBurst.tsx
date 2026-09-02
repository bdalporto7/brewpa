"use client";

const PARTICLES = Array.from({ length: 12 }, (_, i) => {
  const angle = (i / 12) * Math.PI * 2 + (i % 2 === 0 ? 0.15 : -0.1);
  const distance = 55 + (i % 3) * 18;
  return {
    tx: Math.cos(angle) * distance,
    ty: Math.sin(angle) * distance - 10, // slight upward bias so it reads as a "pop," not a pure ring
    delay: (i % 4) * 0.04,
    color: i % 3 === 0 ? "var(--brand)" : "var(--accent)",
  };
});

/**
 * A one-shot burst of bean-shaped particles from the center — plays once on
 * mount, no loop. Used when a roast finishes (see roasts/[id]/page.tsx:
 * gated server-side on "endedAt was within the last few seconds," not a
 * client flag, so it fires exactly once per completion with no cross-
 * component signaling).
 */
export default function BeanBurst() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-visible" aria-hidden="true">
      {PARTICLES.map((p, i) => (
        <svg
          key={i}
          viewBox="0 0 24 24"
          className="absolute h-3 w-3"
          style={{
            animation: `bean-burst 0.9s cubic-bezier(0.2, 0.8, 0.3, 1) ${p.delay}s both`,
            // @ts-expect-error -- custom properties consumed by the bean-burst keyframe
            "--tx": `${p.tx}px`,
            "--ty": `${p.ty}px`,
            color: p.color,
            filter: "url(#sketchy)",
          }}
        >
          <ellipse cx="12" cy="12" rx="5.5" ry="8" fill="currentColor" transform="rotate(-18 12 12)" />
        </svg>
      ))}
    </div>
  );
}
