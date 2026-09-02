import CybarMark from "@/components/ui/CybarMark";

/**
 * A faint, rotated mascot watermark for a top-level page's header — the
 * "recurring stamp" motif. Sits absolutely inside the header's title block
 * (which needs `relative`), not its own layout slot, so it doesn't compete
 * with the title/subtitle for space. Hidden below `sm` since a two-line
 * wrapped h1 on a narrow screen would run under it.
 */
export default function PageStamp() {
  return (
    <div className="pointer-events-none absolute -top-2 right-0 hidden rotate-[10deg] opacity-[0.14] select-none sm:block">
      <CybarMark className="h-20 w-20 sm:h-24 sm:w-24" />
    </div>
  );
}
