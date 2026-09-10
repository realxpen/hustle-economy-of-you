"use client";

import type { Product, Service } from "@hustle/types";
import type { PostMedia } from "./post";
import { getSupabaseBrowserClient } from "./supabase/client";

export type SearchTab = "top" | "people" | "posts" | "services" | "products";
export type MarketplaceTab = "all" | "services" | "products";
export type ResultKind = "person" | "post" | "service" | "product";

export interface SearchFilters {
  category?: string;
  skill?: string;
  location?: string;
  nearby?: boolean;
  minPrice?: string;
  maxPrice?: string;
  verified?: string;
  deliveryMode?: string;
  productType?: string;
}

export interface PublicProfessionalContext {
  id: string;
  headline: string | null;
  primarySkill: string | null;
  secondarySkills: string[];
  category: string | null;
  professionalSummary: string | null;
  yearsExperience: number | null;
  status?: string;
  publishedAt?: string | null;
  updatedAt?: string;
}

export interface PublicOwner {
  id: string;
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
  bio: string | null;
  location: string | null;
  verified: boolean;
  professionalProfile: PublicProfessionalContext;
}

interface ResultBase {
  kind: ResultKind;
  id: string;
  url: string | null;
  ranking: {
    score: number;
    reasons: string[];
  };
}

export interface PersonSearchResult extends ResultBase {
  kind: "person";
  person: PublicOwner;
}

export interface PostSearchResult extends ResultBase {
  kind: "post";
  post: {
    id: string;
    caption: string | null;
    category: string | null;
    location: string | null;
    tags: string[];
    publishedAt: string | null;
    media: PostMedia[];
  };
  owner: PublicOwner;
  engagement: {
    likes: number;
    saves: number;
    comments: number;
  };
}

export interface ServiceSearchResult extends ResultBase {
  kind: "service";
  service: Service;
  owner: PublicOwner;
}

export interface ProductSearchResult extends ResultBase {
  kind: "product";
  product: Product;
  owner: PublicOwner;
}

export type SearchResult =
  | PersonSearchResult
  | PostSearchResult
  | ServiceSearchResult
  | ProductSearchResult;

export interface SearchPage {
  mode: "search" | "marketplace";
  tab: SearchTab | MarketplaceTab;
  query: string | null;
  filters: Record<string, unknown>;
  items: SearchResult[];
  nextCursor: string | null;
  hasMore: boolean;
  zeroResults: boolean;
}

export type SearchObservationEventName =
  | "search.performed"
  | "search.zero_results"
  | "search.result_clicked";

export type MarketplaceObservationEventName =
  | "marketplace.viewed"
  | "marketplace.result_clicked";

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

async function parseError(response: Response) {
  const body = await response.json().catch(() => null) as {
    error?: { message?: string };
    message?: string;
  } | null;
  return body?.error?.message ?? body?.message ?? `Hustle API returned ${response.status}`;
}

async function authenticatedFetch(path: string, init?: RequestInit) {
  const supabase = getSupabaseBrowserClient();
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.access_token) throw new Error("You need to sign in again");

  const headers = new Headers(init?.headers);
  headers.set("authorization", `Bearer ${session.access_token}`);
  if (init?.body) headers.set("content-type", "application/json");

  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers,
    cache: "no-store"
  });
  if (!response.ok) throw new Error(await parseError(response));
  return response;
}

function addFilters(params: URLSearchParams, filters: SearchFilters) {
  if (filters.category?.trim()) params.set("category", filters.category.trim());
  if (filters.skill?.trim()) params.set("skill", filters.skill.trim());
  if (filters.location?.trim()) params.set("location", filters.location.trim());
  if (filters.nearby) params.set("nearby", "true");
  if (filters.minPrice?.trim()) params.set("minPrice", filters.minPrice.trim());
  if (filters.maxPrice?.trim()) params.set("maxPrice", filters.maxPrice.trim());
  if (filters.verified?.trim()) params.set("verified", filters.verified.trim());
  if (filters.deliveryMode?.trim()) params.set("deliveryMode", filters.deliveryMode.trim());
  if (filters.productType?.trim()) params.set("productType", filters.productType.trim());
}

export async function getSearchPage(
  tab: SearchTab,
  options: {
    q: string;
    cursor?: string | null;
    limit?: number;
    filters?: SearchFilters;
  }
): Promise<SearchPage> {
  const params = new URLSearchParams();
  params.set("q", options.q.trim());
  params.set("limit", String(options.limit ?? 12));
  if (options.cursor) params.set("cursor", options.cursor);
  addFilters(params, options.filters ?? {});

  const route = tab === "top" ? "/search" : `/search/${tab}`;
  const response = await authenticatedFetch(`${route}?${params.toString()}`);
  return response.json() as Promise<SearchPage>;
}

export async function getMarketplacePage(
  tab: MarketplaceTab,
  options: {
    q?: string;
    cursor?: string | null;
    limit?: number;
    filters?: SearchFilters;
  } = {}
): Promise<SearchPage> {
  const params = new URLSearchParams();
  params.set("limit", String(options.limit ?? 12));
  if (options.q?.trim()) params.set("q", options.q.trim());
  if (options.cursor) params.set("cursor", options.cursor);
  addFilters(params, options.filters ?? {});

  const route = tab === "all" ? "/marketplace" : `/marketplace/${tab}`;
  const response = await authenticatedFetch(`${route}?${params.toString()}`);
  return response.json() as Promise<SearchPage>;
}

interface ObservationInput {
  query?: string | null;
  tab?: string;
  filters?: Record<string, unknown>;
  resultCount?: number;
  resultType?: ResultKind;
  resultId?: string;
  resultUrl?: string | null;
  position?: number;
  sessionId?: string;
}

async function captureObservation(
  route: "/search/events" | "/marketplace/events",
  name: SearchObservationEventName | MarketplaceObservationEventName,
  input: ObservationInput
) {
  const response = await authenticatedFetch(route, {
    method: "POST",
    keepalive: true,
    body: JSON.stringify({
      name,
      source: "web",
      ...input
    })
  });
  return response.json() as Promise<{
    id: string;
    name: string;
    source: string;
    occurredAt: string;
  }>;
}

export function captureSearchObservation(
  name: SearchObservationEventName,
  input: ObservationInput
) {
  return captureObservation("/search/events", name, input);
}

export function captureMarketplaceObservation(
  name: MarketplaceObservationEventName,
  input: ObservationInput
) {
  return captureObservation("/marketplace/events", name, input);
}
