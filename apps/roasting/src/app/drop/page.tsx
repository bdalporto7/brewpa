import { getUnlockedDrop } from "@/lib/drop-session";
import DropCodeForm from "@/components/drops/DropCodeForm";
import DropOrderForm from "@/components/drops/DropOrderForm";
import CybarMark from "@/components/ui/CybarMark";

export default async function DropPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string }>;
}) {
  const { submitted } = await searchParams;
  const drop = submitted === "1" ? null : await getUnlockedDrop();

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center gap-6 px-4 py-16">
      <CybarMark className="h-10 w-auto" />

      {submitted === "1" ? (
        <div className="text-center">
          <h1 className="text-xl font-bold">Thanks!</h1>
          <p className="mt-2 text-sm text-muted">Your order is in — you&apos;ll hear from me when it&apos;s ready.</p>
        </div>
      ) : !drop ? (
        <div className="flex w-full flex-col gap-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold">Got a drop code?</h1>
            <p className="mt-1 text-sm text-muted">Enter it below to see what&apos;s available.</p>
          </div>
          <DropCodeForm />
        </div>
      ) : (
        <div className="flex w-full flex-col gap-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold">{drop.name}</h1>
            {drop.notes && <p className="mt-1 text-sm text-muted">{drop.notes}</p>}
          </div>
          <DropOrderForm beans={drop.beans} />
        </div>
      )}
    </div>
  );
}
