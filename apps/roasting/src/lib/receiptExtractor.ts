import Anthropic from "@anthropic-ai/sdk";

/**
 * Extracts structured lot details from a purchase receipt photo or PDF —
 * the intake side of the inventory section. Follows the same pattern as
 * supplierExtractor.ts (Claude does the reading, JSON-only reply, nulls
 * for anything not actually present — never fabricated), but over a
 * vision/document input instead of fetched page text.
 *
 * Pure: takes base64 bytes + mime type, returns parsed fields. The Server
 * Action in inventory-actions.ts handles the Blob upload and hands the
 * bytes over.
 */

export type ReceiptWeightUnit = "g" | "kg" | "lb" | "oz";

export interface ReceiptInfo {
  /** Who sold it (roaster/supplier name on the receipt). */
  supplier: string | null;
  /** The coffee/lot name as printed. */
  name: string | null;
  /** Origin country/region if printed. */
  origin: string | null;
  /** Process (Washed/Natural/Honey/...) if printed. */
  process: string | null;
  /** Net weight of green coffee purchased. */
  weightValue: number | null;
  weightUnit: ReceiptWeightUnit | null;
  /** Total price paid for this lot. */
  price: number | null;
  currency: string | null;
  /** Purchase date as YYYY-MM-DD, from the receipt date. */
  purchaseDate: string | null;
  /** How sure the model is about the extraction overall. */
  confidence: "high" | "medium" | "low";
}

const WEIGHT_UNITS = ["g", "kg", "lb", "oz"] as const;

function parseReceiptInfo(raw: unknown): ReceiptInfo {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("Claude's response wasn't a JSON object — try again.");
  }
  const r = raw as Record<string, unknown>;

  const optStr = (v: unknown): string | null =>
    typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
  const optNum = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? v : null;

  const weightUnitRaw = optStr(r.weightUnit)?.toLowerCase();
  const weightUnit = WEIGHT_UNITS.includes(weightUnitRaw as ReceiptWeightUnit)
    ? (weightUnitRaw as ReceiptWeightUnit)
    : null;

  const purchaseDateRaw = optStr(r.purchaseDate);
  const purchaseDate =
    purchaseDateRaw && /^\d{4}-\d{2}-\d{2}$/.test(purchaseDateRaw) ? purchaseDateRaw : null;

  const confidenceRaw = optStr(r.confidence);
  const confidence: ReceiptInfo["confidence"] =
    confidenceRaw === "high" || confidenceRaw === "low" ? confidenceRaw : "medium";

  return {
    supplier: optStr(r.supplier),
    name: optStr(r.name),
    origin: optStr(r.origin),
    process: optStr(r.process),
    weightValue: optNum(r.weightValue),
    weightUnit,
    price: optNum(r.price),
    currency: optStr(r.currency),
    purchaseDate,
    confidence,
  };
}

const SYSTEM_PROMPT = `You are reading a green-coffee purchase receipt — a photo or PDF of an
order confirmation, invoice, or packing slip from a coffee supplier. Extract
the lot details below. This is for inventory intake: the roaster will review
everything before it saves, so accuracy beats completeness.

Extract only what's actually printed:
- supplier: the seller's name (e.g. "Sweet Maria's", "Genuine Origin")
- name: the coffee/lot name (e.g. "Ethiopia Guji Natural")
- origin: country or region, if stated
- process: Washed, Natural, Honey, Anaerobic, etc., if stated
- weightValue + weightUnit: the NET weight of green coffee for this lot
  (not the roast level, not a per-bag count). weightUnit is one of
  "g", "kg", "lb", "oz". If the receipt says "10 lb bag", that's
  weightValue 10, weightUnit "lb". Convert nothing — report the printed unit.
- price: the total price paid for THIS lot (a number, no currency symbol).
  If several lots are on one receipt, pick the one lot this extraction is
  for and ignore the others; if you can't tell which, return null.
- currency: e.g. "USD", if determinable
- purchaseDate: the receipt/order date as YYYY-MM-DD
- confidence: "high" if the key fields (name, weight, price) are all
  clearly legible, "medium" if some are ambiguous, "low" if you're
  guessing at any of them

If a field isn't present or legible, return null for it — never invent a
value to fill the field.

Reply with ONLY a JSON object, no markdown fences, no other text:
{
  "supplier": "<string>" or null,
  "name": "<string>" or null,
  "origin": "<string>" or null,
  "process": "<string>" or null,
  "weightValue": <number> or null,
  "weightUnit": "g" | "kg" | "lb" | "oz" or null,
  "price": <number> or null,
  "currency": "<string>" or null,
  "purchaseDate": "YYYY-MM-DD" or null,
  "confidence": "high" | "medium" | "low"
}`;

/**
 * Reads a receipt image or PDF from base64 bytes. Accepts common image
 * types and PDFs (Anthropic document blocks) — the caller validates the
 * mime type before this is reached.
 */
export async function extractReceiptInfo(base64: string, mimeType: string): Promise<ReceiptInfo> {
  const isPdf = mimeType === "application/pdf";

  // Same identity-linked-key requirement as roastAdvisor.ts's client.
  const client = new Anthropic({
    defaultHeaders: { "anthropic-workspace-id": process.env.ANTHROPIC_WORKSPACE_ID },
  });

  const content: Anthropic.MessageCreateParams["messages"][number]["content"] = [
    isPdf
      ? {
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: base64 },
        }
      : {
          type: "image",
          source: {
            type: "base64",
            media_type: mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
            data: base64,
          },
        },
    {
      type: "text",
      text: "Extract the green-coffee lot details from this receipt.",
    },
  ];

  const response = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 600,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude didn't return a text response.");
  }

  const rawText = textBlock.text
    .trim()
    .replace(/^```(?:json)?\n?/, "")
    .replace(/\n?```$/, "");

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch (e) {
    console.error("extractReceiptInfo: failed to parse Claude's response as JSON.", {
      error: e,
      rawText,
    });
    throw new Error("Claude's response wasn't valid JSON — try again.");
  }

  return parseReceiptInfo(parsed);
}
