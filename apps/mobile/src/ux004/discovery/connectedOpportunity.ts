/**
 * Read-only projection of published people, posts and offers returned by /search.
 * An owner's canonical id is required before displaying matched offers.
 * Neither identity matching nor a search match proves an offer/post attachment.
 */
import type { SearchResult } from "../../experience/feed-api";
import { connectedSearchWebLink } from "./connectedSearchResult";

export type SearchHustler = {
  id: string | null;
  name: string;
  username: string | null;
  skill: string | null;
  headline: string | null;
  summary: string | null;
  location: string | null;
  contactVerified: boolean | null;
};

export function getSearchHustler(item: SearchResult): SearchHustler {
  const person = item.kind === "person" ? item.person : item.owner;
  return {
    id: (item.kind === "person" ? person?.id || item.id : person?.id) || null,
    name: person?.displayName?.trim() || person?.username?.trim() || "Published Hustler",
    username: person?.username || null,
    skill: person?.professionalProfile?.primarySkill || null,
    headline: person?.professionalProfile?.headline || null,
    summary: (item.kind === "person" ? item.person?.bio : item.owner?.bio)
      || person?.professionalProfile?.professionalSummary || null,
    location: person?.location || null,
    contactVerified: typeof person?.verified === "boolean" ? person.verified : null
  };
}

export function matchedPublishedOffers(items: SearchResult[], source: SearchResult): SearchResult[] {
  const ownerId = getSearchHustler(source).id;
  if (!ownerId) return source.kind === "service" || source.kind === "product" ? [source] : [];
  const candidates = source.kind === "service" || source.kind === "product"
    ? [source, ...items] : items;
  const seen = new Set<string>();
  return candidates.filter(item => {
    if (item.kind !== "service" && item.kind !== "product") return false;
    if (item.owner?.id !== ownerId) return false;
    const key = item.kind + ":" + item.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function currentSearchOffer(item: SearchResult) {
  if (item.kind === "service") return item.service || null;
  if (item.kind === "product") return item.product || null;
  return null;
}

/** Canonical public /u path based on the *returned* username, no arbitrary URL. */
export function searchHustlerPublicLink(source: SearchResult, webOrigin?: string): string | null {
  const hustler = getSearchHustler(source);
  if (!hustler.username || !hustler.id) return null;
  return connectedSearchWebLink({
    kind: "person", id: hustler.id, person: { username: hustler.username },
    url: "/u/" + hustler.username
  }, webOrigin);
}
