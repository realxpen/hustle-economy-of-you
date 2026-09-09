"use client";

import type { Product, Service } from "@hustle/types";
import type { PostMedia } from "./post";
import { getSupabaseBrowserClient } from "./supabase/client";

export type FeedTab = "for-you" | "nearby" | "connections";
export type FeedDiscoveryEventName =
  | "feed.impression"
  | "feed.view"
  | "feed.watch"
  | "feed.profile_clicked"
  | "feed.service_clicked"
  | "feed.product_clicked";

export interface FeedItem {
  post: {
    id: string;
    caption: string | null;
    category: string | null;
    location: string | null;
    tags: string[];
    publishedAt: string | null;
    media: PostMedia[];
  };
  creator: {
    id: string;
    displayName: string | null;
    username: string | null;
    avatarUrl: string | null;
    bio: string | null;
    location: string | null;
    verified: boolean;
    professionalProfile: {
      id: string;
      headline: string | null;
      primarySkill: string | null;
      secondarySkills: string[];
      category: string | null;
      professionalSummary: string | null;
      yearsExperience: number | null;
    };
  };
  engagement: {
    likes: number;
    saves: number;
    comments: number;
  };
  viewer: {
    liked: boolean;
    saved: boolean;
    following: boolean;
  };
  services: Service[];
  products: Product[];
  ranking: {
    score: number;
    reasons: string[];
  };
}

export interface FeedPage {
  tab: FeedTab;
  items: FeedItem[];
  nextCursor: string | null;
  hasMore: boolean;
  viewerLocation: string | null;
  coldStart: boolean;
  reason?: string;
}

export interface CaptureFeedEventInput {
  name: FeedDiscoveryEventName;
  postId: string;
  feedTab: FeedTab;
  source?: "web" | "mobile";
  position?: number;
  sessionId?: string;
  watchMs?: number;
  serviceId?: string;
  productId?: string;
}

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

export async function getFeedPage(
  tab: FeedTab,
  options: { cursor?: string | null; limit?: number; location?: string | null } = {}
): Promise<FeedPage> {
  const params = new URLSearchParams();
  if (options.cursor) params.set("cursor", options.cursor);
  params.set("limit", String(options.limit ?? 8));
  if (options.location?.trim()) params.set("location", options.location.trim());

  const response = await authenticatedFetch(`/feed/${tab}?${params.toString()}`);
  return response.json() as Promise<FeedPage>;
}

export async function captureFeedEvent(input: CaptureFeedEventInput) {
  const response = await authenticatedFetch("/feed/events", {
    method: "POST",
    keepalive: true,
    body: JSON.stringify({
      ...input,
      source: input.source ?? "web"
    })
  });
  return response.json() as Promise<{
    id: string;
    name: FeedDiscoveryEventName;
    occurredAt: string;
    deduplicated: boolean;
  }>;
}
