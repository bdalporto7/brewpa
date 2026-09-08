"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { importArtisanRoast } from "@/lib/actions";
import { ROAST_LEVELS } from "@/lib/constants";
import ActionForm from "@/components/ActionForm";
import Button from "@/components/ui/Button";
import { TextField, SelectField, TextareaField, FileField } from "@/components/ui/Field";
import type { Bean, RoasterDefinition } from "@prisma/client";

/**
 * Imports a completed roast from an Artisan (artisan-roaster-scope/artisan)
 * .alog file or JSON export — see src/lib/artisanImport.ts for the parser
 * and src/lib/actions.ts's importArtisanRoast for what actually happens on
 * submit. "use client" only for the existing/new bean toggle below, same
 * conditional-fields pattern as AddEventForm — everything else stays a
 * plain form bound to the Server Action via ActionForm.
 */
export default function ImportArtisanRoastForm({
  beans,
  roasterDefinitions,
}: {
  beans: Bean[];
  roasterDefinitions: RoasterDefinition[];
}) {
  const [beanMode, setBeanMode] = useState<"existing" | "new">(beans.length > 0 ? "existing" : "new");
  const defaultRoasterId = roasterDefinitions.find((r) => r.isDefault)?.id ?? roasterDefinitions[0]?.id;

  return (
    <details className="group rounded-xl border-2 border-[var(--border-strong)] bg-surface shadow-[2px_2px_0_var(--shadow-ink)]">
      <summary className="flex cursor-pointer items-center gap-1.5 px-4 py-3 text-sm font-medium group-open:border-b group-open:border-border">
        <Upload className="h-4 w-4" /> Import from Artisan
      </summary>
      <ActionForm action={importArtisanRoast} className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <FileField label="Artisan file (.alog or .json)" name="file" accept=".alog,.json" required />
        </div>

        <div className="flex gap-4 text-sm sm:col-span-2">
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="beanMode"
              value="existing"
              checked={beanMode === "existing"}
              onChange={() => setBeanMode("existing")}
              disabled={beans.length === 0}
            />
            Existing bean
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="beanMode"
              value="new"
              checked={beanMode === "new"}
              onChange={() => setBeanMode("new")}
            />
            New bean from file
          </label>
        </div>

        {beanMode === "existing" ? (
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
        ) : (
          <>
            <TextField label="Bean name" name="newBeanName" placeholder="Guessed from file if left blank" />
            <TextField label="Origin" name="newBeanOrigin" required placeholder="e.g. Peru" />
            <TextField label="Process" name="newBeanProcess" required placeholder="e.g. Washed" />
          </>
        )}

        {roasterDefinitions.length > 1 ? (
          <SelectField label="Roaster" name="roasterDefinitionId" defaultValue={defaultRoasterId}>
            {roasterDefinitions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </SelectField>
        ) : (
          <input type="hidden" name="roasterDefinitionId" value={defaultRoasterId} />
        )}

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
          Milestones (dry end, cracks, drop) and both temperature curves come straight from the file. Dial
          changes map onto the selected roaster&rsquo;s own controls where the names match, otherwise
          they&rsquo;re kept as notes.
        </p>
        <div className="sm:col-span-2">
          <Button type="submit">Import roast</Button>
        </div>
      </ActionForm>
    </details>
  );
}
