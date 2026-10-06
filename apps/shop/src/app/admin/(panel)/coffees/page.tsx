import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/admin";
import { listAdminCoffees } from "@/lib/square-admin";
import CoffeeEditor from "@/components/CoffeeEditor";

export const dynamic = "force-dynamic";

export default async function CoffeesPage() {
  const user = await getAdminUser();
  if (!user) redirect("/admin/login");

  let data: Awaited<ReturnType<typeof listAdminCoffees>> | null = null;
  let failure: string | null = null;
  try {
    data = await listAdminCoffees();
  } catch (err) {
    console.error("Could not load coffees from Square", err);
    failure = "Couldn't reach Square. Check the connection and try again.";
  }

  return (
    <div>
      <h1 className="text-4xl font-extrabold tracking-tight">Coffees</h1>
      <p className="mt-2 max-w-prose text-sm text-muted">
        Show or hide coffees, keep bag counts right, and edit the details customers read. Everything here is saved
        straight to Square, so the register and the website always agree.
      </p>

      {failure && <p role="alert" className="mt-6 rounded-lg border-2 border-accent px-4 py-3 font-semibold">{failure}</p>}

      {data && !data.hasShopCategory && (
        <p role="alert" className="mt-6 rounded-lg border-2 border-accent px-4 py-3 font-semibold">
          Square doesn&apos;t have the &ldquo;Shop&rdquo; category yet, so coffees can&apos;t be shown. The one-time setup creates it.
        </p>
      )}

      {data && data.coffees.length === 0 && !failure && (
        <div className="mt-8 rounded-lg border-2 border-dashed border-[var(--border-strong)] px-6 py-12 text-center">
          <p className="text-lg font-bold">No coffees in Square yet.</p>
          <p className="mt-1 text-muted">Add a coffee item with bag sizes in Square and it appears here.</p>
        </div>
      )}

      <div className="mt-8 space-y-6">
        {data?.coffees.map((c) => <CoffeeEditor key={c.id} coffee={c} />)}
      </div>
    </div>
  );
}
