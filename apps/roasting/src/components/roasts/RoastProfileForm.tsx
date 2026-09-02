"use client";

import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { createRoastProfile, updateRoastProfile } from "@/lib/profile-actions";
import { PROCESSES, ROAST_BREW_TARGETS, SR800_LEVEL_MIN, SR800_LEVEL_MAX } from "@/lib/constants";
import { formatMMSS, parseMMSS } from "@/lib/format";
import ActionForm from "@/components/ActionForm";
import Button from "@/components/ui/Button";
import { TextField, TextareaField, SelectField } from "@/components/ui/Field";
import type { RoastProfile } from "@prisma/client";
import type { PlanSettingChange, PlanTargets } from "@/lib/curve";

let nextRowId = 0;
function newRowId() {
  nextRowId += 1;
  return nextRowId;
}

interface Row {
  id: number;
  mmss: string;
  fanLevel: string;
  heatLevel: string;
}

function rowsFromPlan(settingChanges: PlanSettingChange[]): Row[] {
  return settingChanges.map((c) => ({
    id: newRowId(),
    mmss: formatMMSS(c.atSeconds),
    fanLevel: c.fanLevel != null ? String(c.fanLevel) : "",
    heatLevel: c.heatLevel != null ? String(c.heatLevel) : "",
  }));
}

/**
 * Dial-schedule rows key off a monotonically increasing `id` (`newRowId()`),
 * not their position in the array — deleting a row from the middle would
 * otherwise shift every following row onto a new index-as-key, and React
 * would recycle each `<input>`'s DOM node (including whatever's mid-typed
 * in it) onto the wrong row instead of actually removing one.
 */
export default function RoastProfileForm({
  profile,
  onSuccess,
  onCancel,
}: {
  profile?: RoastProfile;
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const initial = useMemo(() => {
    if (!profile) return { settingChanges: [] as PlanSettingChange[], targets: {} as PlanTargets };
    return JSON.parse(profile.planJson) as { settingChanges: PlanSettingChange[]; targets: PlanTargets };
  }, [profile]);

  const [rows, setRows] = useState<Row[]>(() =>
    initial.settingChanges.length > 0 ? rowsFromPlan(initial.settingChanges) : [{ id: newRowId(), mmss: "0:00", fanLevel: "", heatLevel: "" }]
  );

  const settingChangesJson = useMemo(() => {
    const parsed: PlanSettingChange[] = rows
      .map((r) => {
        const atSeconds = parseMMSS(r.mmss);
        if (atSeconds == null) return null;
        const entry: PlanSettingChange = { atSeconds };
        if (r.fanLevel !== "") entry.fanLevel = Number(r.fanLevel);
        if (r.heatLevel !== "") entry.heatLevel = Number(r.heatLevel);
        return entry;
      })
      .filter((r): r is PlanSettingChange => r != null && (r.fanLevel != null || r.heatLevel != null));
    return JSON.stringify(parsed);
  }, [rows]);

  function updateRow(id: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  const action = profile ? updateRoastProfile.bind(null, profile.id) : createRoastProfile;

  return (
    <ActionForm action={action} onSuccess={onSuccess} className="flex flex-col gap-4">
      <input type="hidden" name="settingChangesJson" readOnly value={settingChangesJson} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="col-span-2">
          <TextField label="Name" name="name" required defaultValue={profile?.name} placeholder="Bright &amp; fruity natural" />
        </div>
        <SelectField label="Process" name="process" defaultValue={profile?.process ?? ""}>
          <option value="">Not specific</option>
          {PROCESSES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </SelectField>
        <SelectField label="Brewing for" name="brewTarget" defaultValue={profile?.brewTarget ?? ""}>
          <option value="">Not specific</option>
          {ROAST_BREW_TARGETS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </SelectField>
        <div className="col-span-2 sm:col-span-4">
          <TextareaField
            label="Description"
            name="description"
            rows={2}
            defaultValue={profile?.description ?? ""}
            placeholder="What this profile is for, why it works…"
          />
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-muted uppercase tracking-wide">Dial schedule</p>
        <div className="flex flex-col gap-2">
          {rows.map((row) => (
            <div key={row.id} className="flex items-center gap-2">
              <input
                type="text"
                value={row.mmss}
                onChange={(e) => updateRow(row.id, { mmss: e.target.value })}
                placeholder="0:00"
                className="w-16 rounded-md border border-border bg-surface px-2 py-1.5 font-mono text-sm focus:border-accent focus:outline-none"
              />
              <input
                type="number"
                min={SR800_LEVEL_MIN}
                max={SR800_LEVEL_MAX}
                value={row.fanLevel}
                onChange={(e) => updateRow(row.id, { fanLevel: e.target.value })}
                placeholder="Fan"
                className="w-16 rounded-md border border-border bg-surface px-2 py-1.5 font-mono text-sm focus:border-accent focus:outline-none"
              />
              <input
                type="number"
                min={SR800_LEVEL_MIN}
                max={SR800_LEVEL_MAX}
                value={row.heatLevel}
                onChange={(e) => updateRow(row.id, { heatLevel: e.target.value })}
                placeholder="Heat"
                className="w-16 rounded-md border border-border bg-surface px-2 py-1.5 font-mono text-sm focus:border-accent focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setRows((prev) => prev.filter((r) => r.id !== row.id))}
                aria-label="Remove this dial change"
                className="text-muted transition hover:text-danger"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-fit"
            onClick={() => setRows((prev) => [...prev, { id: newRowId(), mmss: "", fanLevel: "", heatLevel: "" }])}
          >
            <Plus className="h-3.5 w-3.5" /> Add change
          </Button>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-muted uppercase tracking-wide">Targets</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <TextField
            label="Dry end (m:ss)"
            name="dryEndMMSS"
            defaultValue={initial.targets.dryEndSeconds != null ? formatMMSS(initial.targets.dryEndSeconds) : ""}
            placeholder="2:30"
            mono
          />
          <TextField
            label="Yellowing end (m:ss)"
            name="yellowingEndMMSS"
            defaultValue={initial.targets.yellowingEndSeconds != null ? formatMMSS(initial.targets.yellowingEndSeconds) : ""}
            placeholder="3:00"
            mono
          />
          <TextField
            label="1st crack (m:ss)"
            name="firstCrackMMSS"
            defaultValue={initial.targets.firstCrackSeconds != null ? formatMMSS(initial.targets.firstCrackSeconds) : ""}
            placeholder="6:30"
            mono
          />
          <TextField
            label="Development (m:ss)"
            name="developmentMMSS"
            defaultValue={initial.targets.developmentSeconds != null ? formatMMSS(initial.targets.developmentSeconds) : ""}
            placeholder="1:00"
            mono
          />
          <TextField
            label="Drop temp (°F)"
            name="dropTempF"
            type="number"
            step="1"
            defaultValue={initial.targets.dropTempF ?? ""}
            mono
          />
          <TextField
            label="Target weight loss (%)"
            name="targetWeightLossPercent"
            type="number"
            step="0.1"
            defaultValue={initial.targets.targetWeightLossPercent ?? ""}
            mono
          />
        </div>
      </div>

      <div className="flex gap-2">
        <Button type="submit" size="sm">
          {profile ? "Save" : "Create profile"}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </ActionForm>
  );
}
