/**
 * Pure (non-server) constants and helpers for sales leads — kept out of the
 * "use server" actions module so client components can import them too
 * (same split as plans.ts).
 */

export const LEAD_STATUSES = ["new", "contacted", "sampling", "negotiating", "won", "lost"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  sampling: "Sampling",
  negotiating: "Negotiating",
  won: "Won",
  lost: "Lost",
};

/** Timeline entry kinds. "status" entries are written automatically when a lead's status changes. */
export const LEAD_UPDATE_KINDS = ["note", "call", "email", "meeting", "sample", "status"] as const;
export type LeadUpdateKind = (typeof LEAD_UPDATE_KINDS)[number];

export const LEAD_UPDATE_LABELS: Record<LeadUpdateKind, string> = {
  note: "Note",
  call: "Call",
  email: "Email",
  meeting: "Meeting",
  sample: "Sample",
  status: "Status",
};

/** Statuses where the lead is still being worked — the open pipeline. */
export const OPEN_STATUSES: readonly LeadStatus[] = ["new", "contacted", "sampling", "negotiating"];

export function isLeadStatus(value: string): value is LeadStatus {
  return (LEAD_STATUSES as readonly string[]).includes(value);
}

export function isLeadUpdateKind(value: string): value is LeadUpdateKind {
  return (LEAD_UPDATE_KINDS as readonly string[]).includes(value);
}

/**
 * How an allocation counts toward demand on its lot:
 * - "firm": the lead is won and the allocation isn't fulfilled — real commitment.
 * - "soft": the lead is still open — likely but not certain.
 * - "none": lead lost, or this allocation already fulfilled.
 */
export function allocationWeight(
  leadStatus: string,
  fulfilledAt: Date | null
): "firm" | "soft" | "none" {
  if (fulfilledAt) return "none";
  if (leadStatus === "won") return "firm";
  if (leadStatus === "lost") return "none";
  return "soft";
}
