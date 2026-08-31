import Anthropic from "@anthropic-ai/sdk";

const FETCH_TIMEOUT_MS = 8000;
// After stripping to plain text, before sending to Claude — caps tokens
// spent on a single page rather than trying to read the whole thing; a
// product page's tasting notes/Q-grade are near the top of the content,
// not buried tens of thousands of characters in.
const MAX_TEXT_CHARS = 20000;

// Covers what actually shows up in coffee-supplier product pages — not a
// full HTML5 entity table (no parser dependency in this project).
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  mdash: "—",
  ndash: "–",
  hellip: "…",
};

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&([a-zA-Z]+);/g, (match, name) => NAMED_ENTITIES[name] ?? match);
}

// No HTML-parsing dependency in this project — a regex-based tag strip
// down to visible text instead of real DOM parsing. Turns block-level tag
// boundaries into newlines first so paragraphs/list items/headings don't
// run together, then drops every remaining tag and collapses whitespace.
// This is most of this feature's token cost: raw HTML for a typical
// product page is dominated by attributes, scripts, and markup rather
// than the copy Claude actually needs, so stripping to text before the
// character cap (rather than after, on raw markup) is what makes the cap
// mean "20000 characters of real content" instead of "mostly tag noise."
function htmlToText(html: string): string {
  const withoutNoise = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");

  const withLineBreaks = withoutNoise
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, "\n");

  const textOnly = decodeHtmlEntities(withLineBreaks.replace(/<[^>]+>/g, " "));

  return textOnly
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

// Coffee-review vocabulary a tasting-notes/Q-grade section is virtually
// guaranteed to use somewhere in its own text (a heading like "Cupping
// Notes" sits right next to, or as part of, the actual paragraph in these
// product pages' markup — htmlToText's block-tag-to-newline conversion
// already keeps a paragraph as one line, so the matching line IS the
// content, not just a nearby heading). No neighboring-line context window:
// tested with one, and on real pages it only pulled in an extra unrelated
// paragraph per match without adding any real descriptors — since we only
// need short keywords out the other end (not full prose), there's nothing
// worth paying for in that adjacent text.
//
// Tried narrowing by HTML structure first (extracting just <main>/
// <article>, stripping <nav>/<header>/<footer>) — reverted after testing
// against real supplier pages: Sweet Maria's product pages nest an
// unrelated <header> around the real <main> block, so a regex tag-strip
// (no real DOM parser in this project) silently deleted the actual
// content along with it. Filtering by keyword on already-linearized text
// has no such nesting hazard.
const RELEVANT_KEYWORDS =
  /\b(tasting|taste|flavou?r|cup(ping)?|aroma|acidity|body|sweetness|finish|notes?|score|grade|rating|sca)\b/i;

function filterRelevantLines(text: string): string {
  const matched = text.split("\n").filter((line) => RELEVANT_KEYWORDS.test(line));
  // Repeated markup (e.g. the same blurb in a "you might also like" rail)
  // produces duplicate lines — drop them before they're paid for twice.
  const deduped = [...new Set(matched)];
  // Falls back to the unfiltered text rather than sending nothing — a page
  // that happens to use none of these words shouldn't produce an empty
  // prompt (which would just come back null for both fields anyway).
  return deduped.length > 0 ? deduped.join("\n") : text;
}

async function fetchSupplierPageText(url: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  } catch (e) {
    throw new Error(
      e instanceof Error && e.name === "TimeoutError"
        ? "Timed out reaching the supplier page — try again or paste notes manually."
        : "Couldn't reach the supplier page — try again or paste notes manually."
    );
  }
  if (!res.ok) {
    throw new Error(`Supplier page returned ${res.status} — try again or paste notes manually.`);
  }

  const html = await res.text();
  return filterRelevantLines(htmlToText(html)).slice(0, MAX_TEXT_CHARS);
}

export interface SupplierInfo {
  /** Comma-separated, up to 10 short descriptors (e.g. "citrus, honey,
   * black tea") — not a prose write-up. Stored as one string since
   * Bean.tastingNotes is a plain text column. */
  tastingNotes: string | null;
  qGrade: number | null;
}

const MAX_TASTING_NOTES = 10;

function parseSupplierInfo(raw: unknown): SupplierInfo {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("Claude's response wasn't a JSON object — try again.");
  }
  const r = raw as Record<string, unknown>;

  const notes = Array.isArray(r.tastingNotes)
    ? r.tastingNotes.filter((n): n is string => typeof n === "string" && n.trim().length > 0).map((n) => n.trim())
    : [];
  const tastingNotes = notes.length > 0 ? notes.slice(0, MAX_TASTING_NOTES).join(", ") : null;

  const qGrade =
    typeof r.qGrade === "number" && r.qGrade >= 0 && r.qGrade <= 100 ? Math.round(r.qGrade * 10) / 10 : null;

  return { tastingNotes, qGrade };
}

const SYSTEM_PROMPT = `You are extracting structured coffee bean information from a green-coffee
supplier or producer's product page. You'll be given the bean's name and
excerpts of the page's visible text (HTML markup stripped, and lines
unrelated to tasting or scoring filtered out — so this is a partial view
of the page, not the whole thing, and line breaks are loose paragraph/
section boundaries rather than meaningful structure).

Extract only two things, and only if they're actually present in the text:
- Up to 10 short tasting-note descriptors — single words or very short
  phrases (e.g. "citrus", "honey", "black tea", "peach"), NOT full
  sentences or a paragraph write-up. Pull the most specific, concrete
  flavor/aroma terms mentioned; skip generic filler ("delicious", "great
  cup", "smooth"). Return fewer than 10 if that's all the page has — don't
  pad the list to reach 10, and don't invent or embellish notes that
  aren't there.
- A numeric Q-grade or cupping score, if explicitly stated (typically in
  the 80-100 range).

If either isn't present, return null for it — never guess or fabricate a
value to fill the field.

Reply with ONLY a JSON object, no markdown fences, no other text:
{
  "tastingNotes": ["<string>", ...] or null,
  "qGrade": <number, or null>
}`;

export async function extractSupplierInfo(url: string, beanName: string): Promise<SupplierInfo> {
  const pageText = await fetchSupplierPageText(url);

  // Same identity-linked-key requirement as roastAdvisor.ts's client.
  const client = new Anthropic({
    defaultHeaders: { "anthropic-workspace-id": process.env.ANTHROPIC_WORKSPACE_ID },
  });

  const response = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 300,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Bean: ${beanName}\n\nPage text:\n${pageText}`,
      },
    ],
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
    console.error("extractSupplierInfo: failed to parse Claude's response as JSON.", {
      error: e,
      rawText,
    });
    throw new Error("Claude's response wasn't valid JSON — try again.");
  }

  return parseSupplierInfo(parsed);
}
