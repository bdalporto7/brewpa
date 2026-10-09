import Link from "next/link";
import { notFound } from "next/navigation";
import LotForm from "@/components/inventory/LotForm";
import { getLot } from "@/lib/inventory-connector/queries";
import { updateLot } from "@/lib/inventory-connector/actions";

export default async function EditLotPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lot = await getLot(id);
  if (!lot) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/inventory/lots/${lot.id}`} className="text-sm text-muted hover:text-foreground">
          ← {lot.name}
        </Link>
        <h2 className="mt-1 text-3xl font-semibold tracking-tight">Edit lot</h2>
      </div>
      <LotForm initial={lot} action={updateLot.bind(null, lot.id)} submitLabel="Save changes" />
    </div>
  );
}
