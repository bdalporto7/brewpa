"use client";

import { useState } from "react";
import { Coffee } from "lucide-react";
import { format } from "date-fns";
import { deleteCuppingNote } from "@/lib/actions";
import { computeCuppingTotal, PRIMARY_SCORE_FIELDS, DERIVED_SCORE_FIELDS, SCORE_LABELS, type ScoreField } from "@/lib/cupping";
import CuppingNoteForm from "@/components/roasts/CuppingNoteForm";
import DeleteButton from "@/components/DeleteButton";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Eyebrow from "@/components/ui/Eyebrow";
import type { CuppingNote } from "@prisma/client";

const DISPLAY_FIELDS: ScoreField[] = [...PRIMARY_SCORE_FIELDS, ...DERIVED_SCORE_FIELDS];

function ScoreGrid({ note }: { note: CuppingNote }) {
  const filled = DISPLAY_FIELDS.filter((f) => note[f] != null);
  if (filled.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1 border-t border-border pt-2 text-sm sm:grid-cols-3">
      {filled.map((f) => (
        <div key={f} className="flex justify-between gap-2">
          <span className="text-muted">{SCORE_LABELS[f]}</span>
          <span className="font-mono">{note[f]}</span>
        </div>
      ))}
      {note.defects != null && (
        <div className="flex justify-between gap-2">
          <span className="text-muted">Defects</span>
          <span className="font-mono text-danger">-{note.defects}</span>
        </div>
      )}
    </div>
  );
}

function CuppingNoteCard({ note, roastSessionId }: { note: CuppingNote; roastSessionId: string }) {
  const [isEditing, setIsEditing] = useState(false);
  const total = computeCuppingTotal(note);

  if (isEditing) {
    return (
      <Card interactive={false} className="p-4">
        <CuppingNoteForm roastSessionId={roastSessionId} note={note} onDone={() => setIsEditing(false)} />
      </Card>
    );
  }

  return (
    <Card interactive={false} className="p-4">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <p className="text-sm font-medium">{format(note.cuppedAt, "MMM d, yyyy")}</p>
          {total != null && (
            <p className="font-mono text-lg font-semibold text-accent">{total.toFixed(2)}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="text-xs font-medium text-muted transition hover:text-foreground"
          >
            Edit
          </button>
          <DeleteButton
            action={deleteCuppingNote.bind(null, roastSessionId, note.id)}
            confirmText="Delete this cupping note?"
            label="Delete"
          />
        </div>
      </div>
      {note.notes && <p className="mb-2 text-sm whitespace-pre-wrap">{note.notes}</p>}
      <ScoreGrid note={note} />
    </Card>
  );
}

export default function CuppingTab({
  roastSessionId,
  cuppingNotes,
}: {
  roastSessionId: string;
  cuppingNotes: CuppingNote[];
}) {
  const [isAdding, setIsAdding] = useState(cuppingNotes.length === 0);

  return (
    <div className="flex flex-col gap-4">
      {cuppingNotes.map((note) => (
        <CuppingNoteCard key={note.id} note={note} roastSessionId={roastSessionId} />
      ))}

      {isAdding ? (
        <Card interactive={false} className="p-4">
          <Eyebrow icon={<Coffee className="h-3.5 w-3.5" />} className="mb-3">
            New cupping session
          </Eyebrow>
          <CuppingNoteForm roastSessionId={roastSessionId} onDone={() => setIsAdding(false)} />
        </Card>
      ) : (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setIsAdding(true)}
          className="self-start"
        >
          + Add cupping session
        </Button>
      )}
    </div>
  );
}
