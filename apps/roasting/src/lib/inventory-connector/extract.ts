/**
 * AI extraction for inventory intake. Two flows:
 *
 * 1. Receipt scan — Claude vision over a receipt photo/PDF → lot fields.
 * 2. Smart add — fetch a supplier product page's text, Claude extracts
 *    the lot fields from it.
 *
 * Both return nulls for anything not actually present — never fabricated —
 * and the UI always shows the result for review before anything saves.
 */

import Anthropic from "@anthropic-ai/sdk";

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
  /** Currency of the price, e.g. "USD". */
  currency: string | null;
  /** Purchase date as printed on the receipt. */
  purchaseDate: string | null;
  /** How legible/confident the read is — low means hand-check everything. */
  confidence: "high" | "medium" | "low";
}

export interface LotDetails {
  name: string | null;
  origin: string | null;
  producer: string | null;
  process: string | null;
  variety: string | null;
  altitude: string | null;
  supplier: string | null;
  price: number | null;
  currency: string | null;
  /** Listed bag size, if the page states one. */
  weightValue: number | null;
  weightUnit: "g" | "kg" | "lb" | "oz" | null;
  tastingNotes: string | null;
  harvestYear: string | null;
}

const RECEIPT_WEIGHT_UNITS = ["g", "kg", "lb", "oz"] as const;

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
  const weightUnit = RECEIPT_WEIGHT_UNITS.includes(weightUnitRaw as (typeof RECEIPT_WEIGHT_UNITS)[number])
    ? (weightUnitRaw as ReceiptWeightUnit)
    : null;

  const confidenceRaw = optStr(r.confidence)?.toLowerCase();
  const confidence: ReceiptInfo["confidence"] =
    confidenceRaw === "high" || confidenceRaw === "medium" || confidenceRaw === "low"
      ? confidenceRaw
      : "low";

  return {
    supplier: optStr(r.supplier),
    name: optStr(r.name),
    origin: optStr(r.origin),
    process: optStr(r.process),
    weightValue: optNum(r.weightValue),
    weightUnit,
    price: optNum(r.price),
    currency: optStr(r.currency),
    purchaseDate: optStr(r.purchaseDate),
    confidence,
  };
}

const RECEIPT_SYSTEM_PROMPT = `You are reading a green-coffee purchase receipt (photo or PDF) for a small
coffee roaster's inventory. Extract the lot details.

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

function anthropicClient(): Anthropic {
  // Same identity-linked-key requirement as roastAdvisor.ts's client.
  return new Anthropic({
    defaultHeaders: { "anthropic-workspace-id": process.env.ANTHROPIC_WORKSPACE_ID },
  });
}

function stripJsonFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\n?/, "")
    .replace(/\n?```$/, "");
}

function parseJsonResponse(rawText: string, source: string): unknown {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(rawText));
  } catch (e) {
    console.error(`${source}: failed to parse Claude's response as JSON.`, { error: e, rawText });
    throw new Error("Claude's response wasn't valid JSON — try again.");
  }
  return parsed;
}

async function textBlockOf(response: Anthropic.Message): Promise<string> {
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude didn't return a text response.");
  }
  return textBlock.text;
}

/**
 * Reads a receipt image or PDF from base64 bytes. Accepts common image
 * types and PDFs (Anthropic document blocks) — the caller validates the
 * mime type before this is reached.
 */
export async function extractReceiptInfo(base64: string, mimeType: string): Promise<ReceiptInfo> {
  const isPdf = mimeType === "application/pdf";
  const client = anthropicClient();

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
    system: RECEIPT_SYSTEM_PROMPT,
    messages: [{ role: "user", content }],
  });

  return parseReceiptInfo(parseJsonResponse(await textBlockOf(response), "extractReceiptInfo"));
}

// --- Smart add: supplier page text + extraction -----------------------------

const FETCH_TIMEOUT_MS = 12_000;
const MAX_TEXT_CHARS = 12_000;

/** Lines mentioning coffee-buying concepts survive; nav boilerplate doesn't. */
const RELEVANT_KEYWORDS =
  /coffee|origin|process|washed|natural|honey|anaerobic|variet|altitude|masl|tasting|notes|cup|score|harvest|crop|producer|farm|cooperative|price|\$|lb|kg|bag|green/i;

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .join("\n");
}

async function fetchSupplierPageText(url: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  } catch (e) {
    throw new Error(
      e instanceof Error && e.name === "TimeoutError"
        ? "Timed out reaching the supplier page — try again or enter details manually."
        : "Couldn't reach the supplier page — try again or enter details manually."
    );
  }
  if (!res.ok) {
    throw new Error(`Supplier page returned ${res.status} — try again or enter details manually.`);
  }

  const html = await res.text();
  const text = htmlToText(html);
  const matched = text.split("\n").filter((line) => RELEVANT_KEYWORDS.test(line));
  const deduped = [...new Set(matched)];
  const filtered = deduped.length > 0 ? deduped.join("\n") : text;
  return filtered.slice(0, MAX_TEXT_CHARS);
}

function parseLotDetails(raw: unknown): LotDetails {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("Claude's response wasn't a JSON object — try again.");
  }
  const r = raw as Record<string, unknown>;

  const optStr = (v: unknown): string | null =>
    typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
  const optNum = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? v : null;

  const weightUnitRaw = optStr(r.weightUnit)?.toLowerCase();
  const weightUnit = RECEIPT_WEIGHT_UNITS.includes(weightUnitRaw as (typeof RECEIPT_WEIGHT_UNITS)[number])
    ? (weightUnitRaw as LotDetails["weightUnit"])
    : null;

  return {
    name: optStr(r.name),
    origin: optStr(r.origin),
    producer: optStr(r.producer),
    process: optStr(r.process),
    variety: optStr(r.variety),
    altitude: optStr(r.altitude),
    supplier: optStr(r.supplier),
    price: optNum(r.price),
    currency: optStr(r.currency),
    weightValue: optNum(r.weightValue),
    weightUnit,
    tastingNotes: optStr(r.tastingNotes),
    harvestYear: optStr(r.harvestYear),
  };
}

const LOT_DETAILS_SYSTEM_PROMPT = `You are extracting green-coffee lot details from a supplier's product
page so a roaster can create an inventory lot without retyping everything.
You'll be given excerpts of the page's visible text (HTML stripped, lines
unrelated to coffee filtered out — a partial view, not the whole page).

Extract only what's actually stated on the page:
- name: the coffee's name as listed
- origin: country and region (e.g. "Ethiopia, Guji")
- producer: farm, cooperative, or producer name
- process: Washed, Natural, Honey, Anaerobic, etc.
- variety: cultivar/varietal (e.g. "Bourbon", "SL28")
- altitude: as printed (e.g. "1800–2200 masl") — keep the original text
- supplier: the seller's name (the site this page is on)
- price: the listed price for the lot (a number, no currency symbol)
- currency: e.g. "USD", if determinable
- weightValue + weightUnit: the listed bag/lot size. weightUnit is one of
  "g", "kg", "lb", "oz". Convert nothing — report the printed unit.
- tastingNotes: short descriptors joined with ", " (e.g. "peach, honey,
  black tea") — not a prose paragraph
- harvestYear: e.g. "2025/26", if stated

If a field isn't present, return null for it — never guess or fabricate a
value to fill the field.

Reply with ONLY a JSON object, no markdown fences, no other text:
{
  "name": "<string>" or null,
  "origin": "<string>" or null,
  "producer": "<string>" or null,
  "process": "<string>" or null,
  "variety": "<string>" or null,
  "altitude": "<string>" or null,
  "supplier": "<string>" or null,
  "price": <number> or null,
  "currency": "<string>" or null,
  "weightValue": <number> or null,
  "weightUnit": "g" | "kg" | "lb" | "oz" or null,
  "tastingNotes": "<string>" or null,
  "harvestYear": "<string>" or null
}`;

/**
 * Fetches a supplier product page and extracts lot details from it.
 * A plain server fetch — JS-rendered pages and bot-blocked sites come
 * back empty, and the UI says so rather than guessing.
 */
export async function extractLotDetails(url: string): Promise<LotDetails> {
  const pageText = await fetchSupplierPageText(url);
  const client = anthropicClient();

  const response = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 800,
    system: LOT_DETAILS_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Product page URL: ${url}\n\nPage text:\n${pageText}`,
      },
    ],
  });

  return parseLotDetails(parseJsonResponse(await textBlockOf(response), "extractLotDetails"));
}
