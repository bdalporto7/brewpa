"use client";

import { useState } from "react";
import { BookmarkPlus, Check } from "lucide-react";
import { PROCESSES, ROAST_BREW_TARGETS } from "@/lib/constants";
import ActionForm from "@/components/ActionForm";
import Button from "@/components/ui/Button";
import { TextField, SelectField } from "@/components/ui/Field";

/**
 * One shared small inline-reveal form for both "save as profile" points
 * (from an AI suggestion in AiSuggestionPanel, from a completed roast in
 * page.tsx) — same fields either way (name/description/process/brewTarget),
 * just bound to a different action per call site.
 */
export default function SaveProfileForm({
  action,
  defaultName,
  defaultProcess,
  defaultBrewTarget,
}: {
  action: (formData: FormData) => Promise<void>;
  defaultName?: string;
  defaultProcess?: string | null;
  defaultBrewTarget?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  if (saved) {
    return (
      <p className="flex items-center gap-1.5 text-xs font-medium text-accent">
        <Check className="h-3.5 w-3.5" /> Saved as a profile.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-fit items-center gap-1.5 text-xs font-medium text-accent"
      >
        <BookmarkPlus className="h-3.5 w-3.5" /> Save as profile
      </button>
    );
  }

  return (
    <ActionForm
      action={action}
      onSuccess={() => setSaved(true)}
      successMessage={null}
      className="flex flex-col gap-2 rounded-lg border border-border p-3"
    >
      <p className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted uppercase">
        <BookmarkPlus className="h-3.5 w-3.5" />
        Save as profile
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div className="col-span-2 sm:col-span-1">
          <TextField label="Name" name="name" required defaultValue={defaultName} placeholder="Bright & fruity natural" />
        </div>
        <SelectField label="Process" name="process" defaultValue={defaultProcess ?? ""}>
          <option value="">Not specific</option>
          {PROCESSES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </SelectField>
        <SelectField label="Brewing for" name="brewTarget" defaultValue={defaultBrewTarget ?? ""}>
          <option value="">Not specific</option>
          {ROAST_BREW_TARGETS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </SelectField>
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm">
          Save profile
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </ActionForm>
  );
}
