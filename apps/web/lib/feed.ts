"use client";

import type { Product, Service } from "@hustle/types";
import { authenticatedFetch } from "./api/authenticated-fetch";
import type { PostMedia } from "./post";

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

function normalizeFeedPage(page: FeedPage): FeedPage {
  return {
    ...page,
    items: page.items.map((item) => ({
      ...item,
      creator: {
        ...item.creator,
        professionalProfile: item.creator.professionalProfile ?? {
          id: "",
          headline: null,
          primarySkill: null,
          secondarySkills: [],
          category: null,
          professionalSummary: null,
          yearsExperience: null
        }
      }
    }))
  };
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
  const page = await response.json() as FeedPage;
  return normalizeFeedPage(page);
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
