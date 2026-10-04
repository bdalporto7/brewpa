import CalculatorClient from "@/components/inventory/CalculatorClient";
import { getInventoryLots } from "@/lib/inventory-connector/queries";

export default async function CalculatorPage() {
  const lots = await getInventoryLots();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Calculator</h2>
        <p className="mt-1 text-sm text-muted">Two-way: green ↔ roasted through weight loss.</p>
      </div>
      <CalculatorClient
        lots={lots.map((l) => ({
          id: l.id,
          name: l.name,
          sessions: l.roastSessions.map((s) => ({
            greenWeightGrams: s.greenWeightGrams,
            roastedWeightGrams: s.roastedWeightGrams,
          })),
        }))}
      />
    </div>
  );
}
