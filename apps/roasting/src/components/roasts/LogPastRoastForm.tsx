import { History } from "lucide-react";
import { startPastRoast } from "@/lib/actions";
import { ROAST_LEVELS } from "@/lib/constants";
import ActionForm from "@/components/ActionForm";
import Button from "@/components/ui/Button";
import { TextField, SelectField, TextareaField } from "@/components/ui/Field";
import type { Bean } from "@prisma/client";

/** Native <details>/<summary>, not SectionCard — same reasoning as
 * BeanForm's own comment (zero-JS collapse for a form that's closed by
 * default at the top of the roasts list). */
export default function LogPastRoastForm({ beans }: { beans: Bean[] }) {
  if (beans.length === 0) return null;

  return (
    <details className="group rounded-xl border-2 border-[var(--border-strong)] bg-surface shadow-[2px_2px_0_var(--shadow-ink)]">
      <summary className="flex cursor-pointer items-center gap-1.5 px-4 py-3 text-sm font-medium group-open:border-b group-open:border-border">
        <History className="h-4 w-4" /> Log a past roast
      </summary>
      <ActionForm action={startPastRoast} className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
        <SelectField label="Bean" name="beanId" required defaultValue="">
          <option value="" disabled>
            Select bean
          </option>
          {beans.map((bean) => (
            <option key={bean.id} value={bean.id}>
              {bean.name} ({Math.round(bean.remainingGrams * 10) / 10}g left)
            </option>
          ))}
        </SelectField>
        <TextField
          label="Green weight (g)"
          name="greenWeightGrams"
          type="number"
          step="1"
          min="1"
          required
          placeholder="200"
          mono
        />
        <TextField label="Started at" name="startedAt" type="datetime-local" required />
        <TextField label="Duration (m:ss)" name="duration" placeholder="6:30" required mono />
        <TextField
          label="Roasted weight (g)"
          name="roastedWeightGrams"
          type="number"
          step="1"
          min="1"
          placeholder="Optional"
          mono
        />
        <SelectField label="Roast level" name="roastLevel" required defaultValue="">
          <option value="" disabled>
            Select level
          </option>
          {ROAST_LEVELS.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </SelectField>
        <SelectField label="Rating" name="rating" defaultValue="">
          <option value="">No rating</option>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {"★".repeat(n)}
            </option>
          ))}
        </SelectField>
        <div className="sm:col-span-2">
          <TextareaField label="Notes" name="notes" rows={2} placeholder="Optional" />
        </div>
        <p className="text-xs text-muted sm:col-span-2">
          Creates the roast already completed — add its fan/heat/temp/crack events from its page
          afterward.
        </p>
        <div className="sm:col-span-2">
          <Button type="submit">Log roast</Button>
        </div>
      </ActionForm>
    </details>
  );
}
