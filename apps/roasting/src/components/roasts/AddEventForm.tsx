"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { logEvent } from "@/lib/actions";
import { parseMMSS } from "@/lib/format";
import { EVENT_TYPES, EVENT_LABELS, type EventType } from "@/lib/constants";
import type { RoasterControl } from "@/lib/roasters";
import Button from "@/components/ui/Button";
import { TextField, SelectField } from "@/components/ui/Field";

/**
 * DROP is a real `EventType` but isn't offered here — ending a roast goes
 * through the dedicated `dropRoast` action, which stamps the session's
 * `endedAt` in the same transaction as the event. Logging DROP through this
 * generic form would create the event without ever closing out the roast.
 */
export default function AddEventForm({
  roastSessionId,
  controls,
}: {
  roastSessionId: string;
  controls: RoasterControl[];
}) {
  const [type, setType] = useState<EventType>("TEMP");
  const [atInput, setAtInput] = useState("");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const control = controls.find((c) => c.key === type);
  const valueField = control ? "control" : type === "TEMP" ? "temp" : type === "NOTE" ? "note" : null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const atSeconds = parseMMSS(atInput);
    if (atSeconds === null) {
      setError("Time must be m:ss, e.g. 5:23.");
      return;
    }
    if (valueField && !value.trim()) {
      setError("A value is required for this event type.");
      return;
    }
    setError(null);

    startTransition(async () => {
      await logEvent({
        roastSessionId,
        type,
        atSeconds,
        controlValue: valueField === "control" ? Number(value) : undefined,
        tempFahrenheit: valueField === "temp" ? Number(value) : undefined,
        note: valueField === "note" ? value.trim() : undefined,
      });
      setValue("");
    });
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <TextField
        label="Time (m:ss)"
        name="atSeconds"
        placeholder="5:23"
        mono
        value={atInput}
        onChange={(e) => setAtInput(e.target.value)}
      />
      <SelectField
        label="Event"
        name="type"
        value={type}
        onChange={(e) => {
          setType(e.target.value as EventType);
          setValue("");
        }}
      >
        {EVENT_TYPES.filter((t) => t !== "DROP").map((t) => (
          <option key={t} value={t}>
            {EVENT_LABELS[t]}
          </option>
        ))}
      </SelectField>

      {valueField === "control" && control ? (
        <TextField
          label={`${control.label} level`}
          name="value"
          type="number"
          min={control.min}
          max={control.max}
          mono
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      ) : valueField === "temp" ? (
        <TextField
          label="Temp (°F)"
          name="value"
          type="number"
          mono
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      ) : valueField === "note" ? (
        <TextField label="Note" name="value" value={value} onChange={(e) => setValue(e.target.value)} />
      ) : (
        <div />
      )}

      <div className="flex items-end">
        <Button type="submit" size="sm" disabled={isPending}>
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      </div>

      {error && <p className="text-sm text-danger sm:col-span-4">{error}</p>}
    </form>
  );
}
