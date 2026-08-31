"use client";

import { useState, useTransition } from "react";
import { Pencil, ChevronDown } from "lucide-react";
import Button from "@/components/ui/Button";
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
}: {
  icon: ReactNode;
  label: string;
  value: string;
  placeholder: string;
  onSave: (value: string) => Promise<void>;
  /** Omit to hide the Delete affordance entirely (not every use of this needs one). */
  deleteConfirmText?: string;
  /** Only takes effect when there's already a saved value — an empty card
   * always opens straight to the editor, same reasoning as
   * RoastPlanCard's collapsedByDefault. */
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(value);
  const [draft, setDraft] = useState(value);
  const [isEditing, setIsEditing] = useState(!value);
  const [collapsed, setCollapsed] = useState(collapsible && defaultCollapsed && Boolean(value));

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
    setIsEditing(true);
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
      <div className="rounded-xl border-2 border-[var(--border-strong)] bg-surface shadow-[2px_2px_0_var(--shadow-ink)] p-4">
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
      </div>
    );
  }

  return (
    <div className="rounded-xl border-2 border-[var(--border-strong)] bg-surface shadow-[2px_2px_0_var(--shadow-ink)] p-4">
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
          {saved && (
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
    </div>
  );
}
