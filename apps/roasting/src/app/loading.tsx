import CybarMark from "@/components/ui/CybarMark";

export default function Loading() {
  return (
    <div className="flex flex-1 items-center justify-center py-24">
      <div
        className="flex items-center justify-center rounded-full border-4 border-accent p-3 animate-spin"
        style={{ animationDuration: "1.4s" }}
      >
        <CybarMark className="h-8 w-auto" alt="Loading" />
      </div>
    </div>
  );
}
