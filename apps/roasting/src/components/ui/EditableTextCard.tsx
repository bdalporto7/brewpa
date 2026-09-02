"use client";

import { useState, useTransition } from "react";
import { Pencil, ChevronDown } from "lucide-react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import DeleteButton from "@/components/DeleteButton";
import type { ReactNode } from "react";

/**
 * A labeled card for one piece of free text that's saved server-side —
 * shows as read-only once there's a value (Edit to change it, Delete to
 * clear it), or an editable textarea when empty or being edited. Pulled
 * out as a shared piece rather than re-hand-rolling this view/edit/delete
 * dance in every form that's really just "one saved string" (AI suggestion
 * feedback, roast notes) — same pattern each place, only the icon/label/
 * save action differ.
 */
export default function EditableTextCard({
  icon,
  label,
  value,
  placeholder,
  onSave,
  deleteConfirmText,
  collapsible = false,
  defaultCollapsed = false,
  hideWhenEmpty = false,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  placeholder: string;
  onSave: (value: string) => Promise<void>;
  /** Omit to hide the Delete affordance entirely (not every use of this needs one). */
  deleteConfirmText?: string;
  /** Only takes effect when there's already a saved value — an empty card
   * always opens straight to the editor (unless hideWhenEmpty below),
   * since collapsing "nothing" just hides the one way to add it. */
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  /** Swaps "always open when empty" for a minimal "+ Add {label}" trigger
   * instead — for places where most instances are blank and an unprompted
   * open textarea everywhere would be the clutter this exists to avoid. */
  hideWhenEmpty?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(value);
  const [draft, setDraft] = useState(value);
  const [isEditing, setIsEditing] = useState(!value && !hideWhenEmpty);
  const [collapsed, setCollapsed] = useState(collapsible && defaultCollapsed && Boolean(value));

  // Resyncs the read-only display when something OTHER than this card's own
  // onSave changes the underlying value — e.g. a sibling "fetch from
  // supplier" button — while it stays mounted. React's documented
  // adjust-state-during-render pattern (not an effect): only `saved` (not
  // `draft`) so a value change never clobbers text the user is typing.
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setSaved(value);
  }

  function handleSave() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    startTransition(async () => {
      await onSave(trimmed);
      setSaved(trimmed);
      setIsEditing(false);
    });
  }

  async function handleDelete() {
    await onSave("");
    setSaved("");
    setDraft("");
    setIsEditing(!hideWhenEmpty);
  }

  if (!saved && hideWhenEmpty && !isEditing) {
    return (
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        className="flex items-center gap-1 text-xs font-medium text-muted transition hover:text-foreground"
      >
        <Pencil className="h-3 w-3" /> Add {label.toLowerCase()}
      </button>
    );
  }

  const canCollapse = collapsible && Boolean(saved);

  const header = (
    <button
      type="button"
      onClick={() => canCollapse && setCollapsed((v) => !v)}
      disabled={!canCollapse}
      className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted uppercase"
    >
      {icon}
      {label}
      {canCollapse && <ChevronDown className={`h-3 w-3 transition-transform ${collapsed ? "" : "rotate-180"}`} />}
    </button>
  );

  if (!isEditing) {
    return (
      <Card interactive={false} className="p-4">
        <div className={collapsed ? "" : "mb-2 flex items-center justify-between"}>
          {header}
          {!collapsed && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setDraft(saved);
                  setIsEditing(true);
                }}
                className="text-muted transition hover:text-foreground"
                aria-label={`Edit ${label.toLowerCase()}`}
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              {deleteConfirmText && (
                <DeleteButton action={handleDelete} confirmText={deleteConfirmText} label="Delete" successMessage={null} />
              )}
            </div>
          )}
        </div>
        {!collapsed && <p className="text-sm whitespace-pre-wrap">{saved}</p>}
      </Card>
    );
  }

  return (
    <Card interactive={false} className="p-4">
      <div className="mb-2">{header}</div>
      <div className="flex gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          rows={2}
          disabled={isPending}
          className="flex-1 rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none"
        />
        <div className="flex flex-col gap-2">
          <Button size="sm" disabled={isPending} onClick={handleSave}>
            {isPending ? "Saving…" : "Save"}
          </Button>
          {(saved || hideWhenEmpty) && (
            <Button
              size="sm"
              variant="ghost"
              disabled={isPending}
              onClick={() => {
                setDraft(saved);
                setIsEditing(false);
              }}
            >
              Cancel
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
