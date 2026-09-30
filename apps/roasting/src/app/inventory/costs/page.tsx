import CostsClient from "@/components/inventory/CostsClient";
import { getInventoryLots } from "@/lib/inventory-connector/queries";

export default async function CostsPage() {
  const lots = await getInventoryLots();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">True cost</h2>
        <p className="mt-1 text-sm text-muted">What one filled bag really costs, per lot.</p>
      </div>
      <CostsClient
        lots={lots.map((l) => ({
          id: l.id,
          name: l.name,
          purchasePrice: l.purchasePrice,
          weightGrams: l.weightGrams,
          sessions: l.roastSessions.map((s) => ({
            greenWeightGrams: s.greenWeightGrams,
            roastedWeightGrams: s.roastedWeightGrams,
          })),
        }))}
      />
    </div>
  );
}
