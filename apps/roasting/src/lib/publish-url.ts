/**
 * Kept separate from publish.ts, which pulls in node:fs/promises at module
 * top-level — that's fine from Server Components/Actions, but PublishControl
 * (a client component) needs just the URL helper, and importing anything
 * from publish.ts would drag fs into the browser bundle and crash Turbopack.
 */

/** This repo's GitHub Pages origin — single-repo app, not meant to be portable. */
export const GITHUB_PAGES_BASE_URL = "https://bdalporto7.github.io/brewpa";

export function roastPageUrl(id: string): string {
  return `${GITHUB_PAGES_BASE_URL}/roasts/${id}.html`;
}
