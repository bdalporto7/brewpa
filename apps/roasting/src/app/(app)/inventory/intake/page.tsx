import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentAllowedUser } from "@/lib/admin";
import IntakeTabs from "@/components/inventory/intake/IntakeTabs";

/**
 * Lot intake: receipt scan (photo/PDF → Claude vision → confirm) and Smart
 * Add (supplier product URL → Claude extraction → confirm). Both end at
 * the same place — a reviewed lot form — and both refuse to save anything
 * before the roaster confirms.
 */
export default async function IntakePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await getCurrentAllowedUser();
  if (!user) notFound();
  const { tab } = await searchParams;

  const beans = await prisma.bean.findMany({
    where: { teamId: user.teamId },
    select: { id: true, name: true, remainingGrams: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="flex flex-col gap-4">
      <p className="-mt-2 text-sm text-muted">
        Two ways to add a lot without retyping everything — both end with you reviewing the details.
      </p>
      <IntakeTabs beans={beans} initialTab={tab === "smart" ? "smart" : "receipt"} />
    </div>
  );
}
