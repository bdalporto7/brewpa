import IntakeTabs from "@/components/inventory/IntakeTabs";
import ReceiptIntake from "@/components/inventory/ReceiptIntake";
import SmartAddIntake from "@/components/inventory/SmartAddIntake";
import LotForm from "@/components/inventory/LotForm";
import { getInventoryLots } from "@/lib/inventory-connector/queries";
import { createLot } from "@/lib/inventory-connector/actions";

export default async function IntakePage() {
  const lots = await getInventoryLots();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-3xl font-semibold tracking-tight">Intake</h2>
        <p className="mt-1 text-sm text-muted">Add a new lot — by hand, from a receipt, or from a supplier page.</p>
      </div>
      <IntakeTabs
        manual={<LotForm action={createLot} submitLabel="Create lot" successMessage="Lot created" />}
        receipt={
          <ReceiptIntake
            lots={lots.map((l) => ({ id: l.id, name: l.name, remainingGrams: l.remainingGrams }))}
          />
        }
        smart={<SmartAddIntake />}
      />
    </div>
  );
}
