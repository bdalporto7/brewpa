import Link from "next/link";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Eyebrow from "@/components/ui/Eyebrow";
import Form from "@/components/inventory/Form";
import BlendRecipeForm from "@/components/inventory/BlendRecipeForm";
import { getBlends, getInventoryLots } from "@/lib/inventory-connector/queries";
import { createBlendRecipe, updateBlendRecipe, deleteBlendRecipe } from "@/lib/inventory-connector/actions";

export default async function BlendsPage() {
  const [blends, lots] = await Promise.all([getBlends(), getInventoryLots()]);
  const lotOptions = lots.map((l) => ({ id: l.id, name: l.name, remainingGrams: l.remainingGrams }));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-3xl font-semibold tracking-tight">Blends</h2>
        <p className="mt-1 text-sm text-muted">
          Recipes for multi-lot roasts. Logging a blend roast deducts each lot&apos;s share —{" "}
          <Link href="/inventory/roasts" className="underline">
            log one on the Roasts page
          </Link>
          .
        </p>
      </div>

      <section>
        <Eyebrow className="mb-2">New blend</Eyebrow>
        <BlendRecipeForm lots={lotOptions} action={createBlendRecipe} submitLabel="Create blend" />
      </section>

      <section>
        <Eyebrow className="mb-2">Recipes</Eyebrow>
        {blends.length === 0 ? (
          <p className="text-sm text-muted">No blend recipes yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {blends.map((blend) => (
              <Card key={blend.id} interactive={false} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{blend.name}</p>
                    {blend.notes && <p className="mt-0.5 text-sm text-muted">{blend.notes}</p>}
                  </div>
                  <Form action={deleteBlendRecipe.bind(null, blend.id)} successMessage="Blend deleted">
                    <Button type="submit" variant="danger" size="sm">
                      Delete
                    </Button>
                  </Form>
                </div>
                <ul className="mt-2 flex flex-col gap-1">
                  {blend.components.map((c) => (
                    <li key={c.id} className="flex justify-between text-sm">
                      <Link href={`/inventory/lots/${c.bean.id}`} className="hover:underline">
                        {c.bean.name}
                      </Link>
                      <span className="font-mono tabular-nums text-muted">{c.ratioPercent}%</span>
                    </li>
                  ))}
                </ul>
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm text-muted hover:text-foreground">Edit</summary>
                  <div className="mt-3">
                    <BlendRecipeForm
                      recipe={blend}
                      lots={lotOptions}
                      action={updateBlendRecipe.bind(null, blend.id)}
                      submitLabel="Save changes"
                    />
                  </div>
                </details>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
