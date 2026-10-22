/**
 * Pure projection of the existing authenticated NestJS /search response.
 * No invented profiles, prices, ratings, availability or external redirects.
 */
import type { SearchResult } from "../../experience/feed-api";

export type MobileSearchResultView = { title: string; detail: string; kindLabel: string };

export function describeMobileSearchResult(item: SearchResult): MobileSearchResultView {
  const name = item.owner?.displayName?.trim();
  switch (item.kind) {
    case "person": {
      const person = item.person;
      return {
        title: person?.displayName?.trim() || person?.username?.trim() || "Published professional",
        detail: [person?.professionalProfile?.primarySkill || person?.professionalProfile?.headline,
          person?.location].filter(Boolean).join(" · ") || "Published professional profile",
        kindLabel: "Person"
      };
    }
    case "post":
      return {
        title: item.post?.caption?.trim() || "Published work",
        detail: [name, item.post?.category, item.post?.location || item.owner?.location]
          .filter(Boolean).join(" · ") || "Published work",
        kindLabel: "Post"
      };
    case "service":
      return {
        title: item.service?.title?.trim() || "Published service",
        detail: [name, item.service?.category || item.service?.location]
          .filter(Boolean).join(" · ") || "Published service",
        kindLabel: "Service"
      };
    case "product":
      return {
        title: item.product?.title?.trim() || "Published product",
        detail: [name, item.product?.category].filter(Boolean).join(" · ") || "Published product",
        kindLabel: "Product"
      };
    default:
      return { title: "Published result", detail: "Hustle search", kindLabel: "Result" };
  }
}

/**
 * Only link to a canonical path matching the returned ID/username and type.
 * A missing configured Web origin or mismatched API URL means no link.
 * There is no native app session transfer or payment intent.
 */
export function connectedSearchWebLink(item: SearchResult, publicWebOrigin?: string): string | null {
  const origin = publicWebOrigin?.trim().replace(/\/+$/, "");
  if (!origin || !(/^https:\/\/[^\s/?#@]+$/i.test(origin) ||
    /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i.test(origin))) return null;

  let expected: string | null = null;
  if (item.kind === "person") {
    const username = item.person?.username;
    if (username && /^[A-Za-z0-9._-]{1,80}$/.test(username)) expected = "/u/" + username;
  } else if (/^[A-Za-z0-9_-]{1,128}$/.test(item.id)) {
    const segment = item.kind === "post" ? "posts" : item.kind === "service" ? "services" : "products";
    expected = "/" + segment + "/" + item.id;
  }
  return expected && item.url === expected ? origin + expected : null;
}
