"use client";

import { useRouter, usePathname } from "next/navigation";
import { SelectField } from "@/components/ui/Field";

export default function CompareRoastPicker({
  candidates,
  selectedId,
}: {
  candidates: { id: string; label: string }[];
  selectedId: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className="max-w-sm">
      <SelectField
        label="Compare against"
        name="vs"
        value={selectedId ?? ""}
        onChange={(e) => {
          const vs = e.target.value;
          router.push(vs ? `${pathname}?tab=compare&vs=${vs}` : `${pathname}?tab=compare`);
        }}
      >
        <option value="">Select a roast</option>
        {candidates.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </SelectField>
    </div>
  );
}
