/**
 * One shared SVG filter definition, rendered once at the app root, reused
 * by every decorative illustration via `filter: url(#sketchy)` — so the
 * "hand-drawn wobble" amount is dialed in exactly once (tweak the
 * baseFrequency/scale here) rather than re-tuned per component, and stays
 * visually consistent across all of them. Displacement, not path-jitter —
 * cheaper than hand-perturbing each path's control points, and works on
 * any stroke/fill without redrawing it. `x`/`y`/`width`/`height` give the
 * filter region generous padding since displacement can push part of a
 * shape outside its own default bounding box, clipping it otherwise.
 */
export default function SketchyFilterDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <filter id="sketchy" x="-30%" y="-30%" width="160%" height="160%">
        <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="7" result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="3.5" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  );
}
