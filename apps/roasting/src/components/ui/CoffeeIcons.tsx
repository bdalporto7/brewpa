import type { SVGProps } from "react";

/**
 * Real coffee-stage iconography — green bean, roasted bean, brewed cup —
 * replacing generic lucide icons (Sprout, Coffee) that could stand for
 * anything. Colors follow the actual color a coffee goes through: pale
 * sage-green unroasted, --accent roast-brown once roasted, dark liquid
 * brewed. Bean shape (oval + center crease) is the same for green/roasted,
 * distinguished by fill.
 */

function BeanShape({ crease = "rgba(0,0,0,0.35)", ...props }: SVGProps<SVGSVGElement> & { crease?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <ellipse cx="12" cy="12" rx="7" ry="10" fill="currentColor" transform="rotate(-18 12 12)" />
      <path
        d="M12 4 C9 8 9 10.5 12 12 C15 13.5 15 16 12 20"
        stroke={crease}
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
        transform="rotate(-18 12 12)"
        style={{ filter: "url(#sketchy)" }}
      />
    </svg>
  );
}

export function GreenBeanIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <BeanShape {...props} style={{ color: "#8fa876", ...props.style }} crease="rgba(43,29,20,0.3)" />
  );
}

export function RoastedBeanIcon(props: SVGProps<SVGSVGElement>) {
  return <BeanShape {...props} style={{ color: "var(--accent)", ...props.style }} crease="rgba(0,0,0,0.35)" />;
}

export function BrewedCupIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M5 9h11v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V9z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path
        d="M16 10.5h1.5a2.25 2.25 0 0 1 0 4.5H16"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M8 3.5c.6 1-.6 1.5 0 2.5M11.5 3.5c.6 1-.6 1.5 0 2.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        fill="none"
        opacity="0.7"
        style={{ filter: "url(#sketchy)" }}
      />
    </svg>
  );
}
