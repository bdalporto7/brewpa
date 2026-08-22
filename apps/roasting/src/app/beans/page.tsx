import { prisma } from "@/lib/prisma";
import BeanForm from "@/components/BeanForm";
import BeanCard from "@/components/BeanCard";

export default async function BeansPage() {
  const beans = await prisma.bean.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Green Bean Inventory</h1>
        <p className="text-sm text-muted">
          What&apos;s on hand, and how much of it is left.
        </p>
      </div>

      <BeanForm />

      {beans.length === 0 ? (
        <p className="text-sm text-muted">No beans yet — add your first one above.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {beans.map((bean) => (
            <BeanCard key={bean.id} bean={bean} />
          ))}
        </div>
      )}
    </div>
  );
}
