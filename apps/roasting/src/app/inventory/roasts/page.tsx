import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Eyebrow from "@/components/ui/Eyebrow";
import { TextField, TextareaField, SelectField } from "@/components/ui/Field";
import Form from "@/components/inventory/Form";
import WeightInput from "@/components/inventory/WeightInput";
import ArtisanImportForm from "@/components/inventory/ArtisanImportForm";
import {
  getInventoryLots,
  getRecentRoasts,
  getRoasterDefinitions,
  getBlends,
  ROAST_LEVELS,
} from "@/lib/inventory-connector/queries";
import { logRoast, logBlendRoast } from "@/lib/inventory-connector/actions";
import { fifoOrder, formatWeight } from "@/lib/inventory-connector/math";
import { format } from "date-fns";

export default async function RoastsPage() {
  const [lots, sessions, roasters, blends] = await Promise.all([
    getInventoryLots(),
    getRecentRoasts(40),
    getRoasterDefinitions(),
    getBlends(),
  ]);

  const orderedLots = fifoOrder(lots.filter((l) => l.remainingGrams > 0));
  const defaultRoasterId = roasters.find((r) => r.isDefault)?.id ?? roasters[0]?.id ?? "";

  // Group blend components (shared blendBatchId) into one log entry.
  const entries: { key: string; sessions: typeof sessions }[] = [];
  for (const s of sessions) {
    const last = entries[entries.length - 1];
    if (s.blendBatchId && last && last.sessions[0]?.blendBatchId === s.blendBatchId) {
      last.sessions.push(s);
    } else {
      entries.push({ key: s.blendBatchId ?? s.id, sessions: [s] });
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-3xl font-semibold tracking-tight">Roasts</h2>
        <p className="mt-1 text-sm text-muted">
          Log a roast after the fact — green is deducted from the lot immediately.
        </p>
      </div>

      <section>
        <Eyebrow className="mb-2">Log a roast</Eyebrow>
        <Card interactive={false} className="p-4 sm:p-5">
          <Form action={logRoast} successMessage="Roast logged" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SelectField label="Lot *" name="beanId" required defaultValue="">
              <option value="" disabled>
                Choose a lot…
              </option>
              {orderedLots.map((lot) => (
                <option key={lot.id} value={lot.id}>
                  {lot.name} ({Math.round(lot.remainingGrams)}g left)
                </option>
              ))}
            </SelectField>
            <SelectField label="Roast level *" name="roastLevel" required defaultValue="">
              <option value="" disabled>
                Select level…
              </option>
              {ROAST_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </SelectField>
            <WeightInput label="Green weight *" name="greenWeightGrams" required />
            <WeightInput label="Roasted yield" name="roastedWeightGrams" />
            {roasters.length > 1 ? (
              <SelectField label="Roaster" name="roasterDefinitionId" defaultValue={defaultRoasterId}>
                {roasters.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </SelectField>
            ) : (
              <input type="hidden" name="roasterDefinitionId" value={defaultRoasterId} />
            )}
            <TextField label="Rating (1–5)" name="rating" type="number" min="1" max="5" step="1" />
            <div className="sm:col-span-2">
              <TextareaField label="Notes" name="notes" rows={2} />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit">Log roast</Button>
            </div>
          </Form>
        </Card>
      </section>

      {blends.length > 0 && (
        <section>
          <Eyebrow className="mb-2">Log a blend roast</Eyebrow>
          <Card interactive={false} className="p-4 sm:p-5">
            <Form action={logBlendRoast} successMessage="Blend roast logged" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <SelectField label="Blend *" name="blendRecipeId" required defaultValue="">
                <option value="" disabled>
                  Choose a blend…
                </option>
                {blends.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </SelectField>
              <SelectField label="Roast level *" name="roastLevel" required defaultValue="">
                <option value="" disabled>
                  Select level…
                </option>
                {ROAST_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </SelectField>
              <WeightInput label="Total green weight *" name="totalGreenGrams" required />
              <WeightInput label="Roasted yield" name="roastedWeightGrams" />
              <input type="hidden" name="roasterDefinitionId" value={defaultRoasterId} />
              <TextField label="Rating (1–5)" name="rating" type="number" min="1" max="5" step="1" />
              <div className="sm:col-span-2">
                <TextareaField label="Notes" name="notes" rows={2} />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit">Log blend roast</Button>
              </div>
            </Form>
          </Card>
        </section>
      )}

      <section>
        <Eyebrow className="mb-2">Import from Artisan</Eyebrow>
        <ArtisanImportForm
          lots={lots.map((l) => ({ id: l.id, name: l.name }))}
          roasters={roasters.map((r) => ({ id: r.id, name: r.name, isDefault: r.isDefault }))}
        />
      </section>

      <section>
        <Eyebrow className="mb-2">Roast log</Eyebrow>
        {entries.length === 0 ? (
          <p className="text-sm text-muted">No roasts logged yet.</p>
        ) : (
          <Card interactive={false} className="divide-y divide-[var(--border)]">
            {entries.map(({ key, sessions: group }) => {
              const first = group[0];
              const totalGreen = group.reduce((sum, s) => sum + s.greenWeightGrams, 0);
              const isBlend = group.length > 1;
              return (
                <div key={key} className="px-4 py-2.5">
                  <div className="flex items-center justify-between">
                    <div className="text-sm">
                      <span className="font-medium">
                        {isBlend
                          ? group.map((s) => s.bean.name).join(" + ")
                          : first.bean.name}
                      </span>
                      {first.roastLevel && <span className="text-muted"> · {first.roastLevel}</span>}
                      {isBlend && <span className="ml-1 text-xs text-muted">(blend)</span>}
                    </div>
                    <span className="font-mono text-sm tabular-nums text-muted">{formatWeight(totalGreen)}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted">
                    {first.startedAt ? format(first.startedAt, "MMM d, yyyy") : "Undated"}
                    {first.rating && ` · ★ ${first.rating}/5`}
                  </p>
                </div>
              );
            })}
          </Card>
        )}
      </section>
    </div>
  );
}
