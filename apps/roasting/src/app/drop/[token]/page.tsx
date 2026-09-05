import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import DropOrderForm from "@/components/drops/DropOrderForm";
import CybarMark from "@/components/ui/CybarMark";

// A leaked/shared link shouldn't end up search-indexed — the accessToken
// is the entire access-control mechanism for this page (see
// drop-actions.ts's generateAccessToken), so keeping it out of search
// results is a real, if secondary, part of that story.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function DropOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ submitted?: string }>;
}) {
  const { token } = await params;
  const { submitted } = await searchParams;

  const drop = await prisma.drop.findUnique({
    where: { accessToken: token },
    include: { beans: { orderBy: { name: "asc" } } },
  });

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center gap-6 px-4 py-16">
      <CybarMark className="h-10 w-auto" />

      {!drop ? (
        <p className="text-center text-sm text-muted">This link isn&apos;t valid.</p>
      ) : drop.closedAt ? (
        <div className="text-center">
          <h1 className="text-xl font-bold">{drop.name}</h1>
          <p className="mt-2 text-sm text-muted">This drop is closed — no more orders.</p>
        </div>
      ) : submitted === "1" ? (
        <div className="text-center">
          <h1 className="text-xl font-bold">Thanks!</h1>
          <p className="mt-2 text-sm text-muted">Your order is in — you&apos;ll hear from me when it&apos;s ready.</p>
        </div>
      ) : (
        <div className="flex w-full flex-col gap-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold">{drop.name}</h1>
            {drop.notes && <p className="mt-1 text-sm text-muted">{drop.notes}</p>}
          </div>
          <DropOrderForm dropId={drop.id} accessToken={drop.accessToken} beans={drop.beans} />
        </div>
      )}
    </div>
  );
}
