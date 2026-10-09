import Link from "next/link";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Eyebrow from "@/components/ui/Eyebrow";
import Form from "@/components/inventory/Form";
import LotCuppingForm from "@/components/inventory/LotCuppingForm";
import { getLotCuppingNotes, getInventoryLots, computeCuppingTotal } from "@/lib/inventory-connector/queries";
import { deleteLotCupping } from "@/lib/inventory-connector/actions";
import { format } from "date-fns";

export default async function CuppingPage({
  searchParams,
}: {
  searchParams: Promise<{ lot?: string }>;
}) {
  const { lot: lotParam } = await searchParams;
  const [notes, lots] = await Promise.all([getLotCuppingNotes(), getInventoryLots()]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-3xl font-semibold tracking-tight">Cupping</h2>
        <p className="mt-1 text-sm text-muted">
          Tasting notes on green lots — arrival samples and pre-roast checks.
        </p>
      </div>

      <section>
        <Eyebrow className="mb-2">New note</Eyebrow>
        <LotCuppingForm
          lots={lots.map((l) => ({ id: l.id, name: l.name }))}
          defaultLotId={lotParam}
        />
      </section>

      <section>
        <Eyebrow className="mb-2">Notes</Eyebrow>
        {notes.length === 0 ? (
          <p className="text-sm text-muted">No lot cupping notes yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {notes.map((note) => {
              const total = computeCuppingTotal(note);
              return (
                <Card key={note.id} interactive={false} className="flex items-start justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="text-sm">
                      <Link href={`/inventory/lots/${note.bean?.id}`} className="font-semibold hover:underline">
                        {note.bean?.name ?? "Unknown lot"}
                      </Link>
                      <span className="ml-2 text-muted">{format(note.cuppedAt, "MMM d, yyyy")}</span>
                      {total != null && (
                        <span className="ml-2 font-mono tabular-nums text-muted">{total.toFixed(1)}</span>
                      )}
                    </p>
                    {note.notes && <p className="mt-1 text-sm text-muted">{note.notes}</p>}
                  </div>
                  <Form action={deleteLotCupping.bind(null, note.id)} successMessage="Note deleted">
                    <Button type="submit" variant="danger" size="sm">
                      Delete
                    </Button>
                  </Form>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
