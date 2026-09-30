import Calculator from "@/components/inventory/Calculator";

/**
 * Two-way calculator: green → roasted → bags, and bags → green needed.
 * Pure client component — no database, no saving, just math.
 */
export default function CalculatorPage() {
  return (
    <div className="flex flex-col gap-4">
      <p className="-mt-2 text-sm text-muted">
        Plan batches and orders. Adjust the weight-loss % to match your roaster — 16% is a typical
        light/medium starting point.
      </p>
      <Calculator />
    </div>
  );
}
