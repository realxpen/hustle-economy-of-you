/**
 * Preserve backend relevance order while appending cursor pages.
 * Canonical result identity is kind + ID, not only ID (types may overlap).
 */
import type { SearchResult } from "../../experience/feed-api";

export function appendUniqueSearchResults(previous: SearchResult[], next: SearchResult[]) {
  const seen = new Set(previous.map(item => item.kind + ":" + item.id));
  const appended: SearchResult[] = [];
  for (const item of next) {
    const key = item.kind + ":" + item.id;
    if (seen.has(key)) continue;
    seen.add(key);
    appended.push(item);
  }
  return previous.concat(appended);
}
