import InventoryNav from "@/components/inventory/InventoryNav";

/**
 * Shell for the /inventory section: a compact section header (dense,
 * tool-like — this is the business working area, not the roast console)
 * plus the section's own tab bar. Deliberately its own visual rhythm from
 * the roasting side: tighter cards, tabular numbers, tables over prose.
 */
export default function InventoryLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-3xl font-black tracking-tight">Inventory</h1>
        <p className="text-sm text-muted">
          Green coffee in, roasted coffee out — lots, roasts, plans, and what they cost.
        </p>
      </div>
      <InventoryNav />
      {children}
    </div>
  );
}
