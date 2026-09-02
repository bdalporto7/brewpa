"use client";

import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";

const PAD_X = 13;
const PAD_Y = 9;

/**
 * A Link that draws a hand-drawn chalk circle around itself the instant
 * it's clicked — the tap acknowledgment right before the page changes, not
 * a separate action. Only ever wraps something that already navigates
 * somewhere; there's no version of this that does something else on
 * click, since an unindicated click target with invented meaning is
 * exactly the confusing thing this was corrected away from during design
 * review.
 *
 * The circle's box is measured from the link's actual rendered pixels on
 * click (not a CSS inset guess) so it fits text of any length without
 * cutting through the first/last letters — see the fixed full-bleed
 * ellipse path below, which touches the SVG's own box edges exactly so
 * the only margin is the PAD_X/PAD_Y this component controls.
 */
export default function TapCircleLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  const wrapRef = useRef<HTMLSpanElement>(null);
  const linkRef = useRef<HTMLAnchorElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [tapped, setTapped] = useState(false);

  function handleClick() {
    const wrap = wrapRef.current;
    const link = linkRef.current;
    const svg = svgRef.current;
    if (wrap && link && svg) {
      const lr = link.getBoundingClientRect();
      const wr = wrap.getBoundingClientRect();
      svg.style.left = `${lr.left - wr.left - PAD_X}px`;
      svg.style.top = `${lr.top - wr.top - PAD_Y}px`;
      svg.style.width = `${lr.width + PAD_X * 2}px`;
      svg.style.height = `${lr.height + PAD_Y * 2}px`;
    }
    setTapped(false);
    // restart the animation even on a repeat click before the first finishes
    requestAnimationFrame(() => setTapped(true));
  }

  return (
    <span ref={wrapRef} className="relative inline-flex">
      <Link ref={linkRef} href={href} className={className} onClick={handleClick}>
        {children}
      </Link>
      <svg
        ref={svgRef}
        viewBox="0 0 100 34"
        preserveAspectRatio="none"
        aria-hidden="true"
        className={`pointer-events-none absolute overflow-visible ${tapped ? "tap-circle-draw" : ""}`}
        onAnimationEnd={() => setTapped(false)}
      >
        <path
          className="tap-circle-path"
          pathLength="1"
          d="M50 0 C77.6 0,100 7.6,100 17 C100 26.4,77.6 34,50 34 C22.4 34,0 26.4,0 17 C0 7.6,22.4 0,50 0 Z"
        />
      </svg>
    </span>
  );
}
