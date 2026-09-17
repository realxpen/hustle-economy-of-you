"use client";

import { getSupabaseBrowserClient } from "./supabase/client";

export type LiveSessionStatus = "DRAFT" | "LIVE" | "ENDED" | "CANCELLED";
export type LivePinnedOfferType = "SERVICE" | "PRODUCT";
export type LiveEventName = "PROFILE_CLICKED" | "SERVICE_CLICKED" | "PRODUCT_CLICKED";

export interface LiveHost {
  id: string;
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
  location: string | null;
  verified: boolean;
  professionalProfile: {
    headline: string | null;
    primarySkill: string | null;
    category: string | null;
  } | null;
}

export interface LiveServiceOffer {
  id: string;
  title: string | null;
  category: string | null;
  priceMinor: number | null;
  currency: string;
  pricingType: "FIXED" | "STARTING_AT" | "HOURLY";
}

export interface LiveProductOffer {
  id: string;
  title: string | null;
  category: string | null;
  priceMinor: number | null;
  currency: string;
  type: "PHYSICAL" | "DIGITAL";
  trackInventory: boolean;
  inventoryQuantity: number | null;
}

export interface LiveSessionRecord {
  id: string;
  hostUserId: string;
  title: string;
  category: string | null;
  status: LiveSessionStatus;
  pinnedOfferType: LivePinnedOfferType | null;
  pinnedServiceId: string | null;
  pinnedProductId: string | null;
  playbackUrl: string | null;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
  host: LiveHost;
  pinnedService: LiveServiceOffer | null;
  pinnedProduct: LiveProductOffer | null;
  interactions: {
    viewers: number;
    comments: number;
  };
  media: {
    playbackUrl: string | null;
    ready: boolean;
    nativeBroadcasting: boolean;
  };
}

export interface LiveCommentRecord {
  id: string;
  sessionId: string;
  userId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    displayName: string | null;
    username: string | null;
    avatarUrl: string | null;
  };
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
  const response = await fetch(`${apiBase}${path}`, { ...init, headers, cache: "no-store" });
  if (!response.ok) throw new Error(await parseError(response));
  return response;
}

export function getLiveViewerKey() {
  if (typeof window === "undefined") return "server:live-viewer";
  const storageKey = "hustle.live.viewerKey";
  const existing = window.localStorage.getItem(storageKey);
  if (existing) return existing;
  const created = `web:${crypto.randomUUID()}`;
  window.localStorage.setItem(storageKey, created);
  return created;
}

export async function getActiveLiveSessions(limit = 20): Promise<LiveSessionRecord[]> {
  const response = await fetch(`${apiBase}/live?limit=${limit}`, { cache: "no-store" });
  if (!response.ok) throw new Error(await parseError(response));
  return response.json() as Promise<LiveSessionRecord[]>;
}

export async function getPublicLiveSession(liveId: string): Promise<LiveSessionRecord> {
  const response = await fetch(`${apiBase}/live/${encodeURIComponent(liveId)}`, { cache: "no-store" });
  if (!response.ok) throw new Error(await parseError(response));
  return response.json() as Promise<LiveSessionRecord>;
}

export async function getMyLiveSessions(): Promise<LiveSessionRecord[]> {
  const response = await authenticatedFetch("/live/mine");
  return response.json() as Promise<LiveSessionRecord[]>;
}

export async function getMyLiveSession(liveId: string): Promise<LiveSessionRecord> {
  const response = await authenticatedFetch(`/live/mine/${encodeURIComponent(liveId)}`);
  return response.json() as Promise<LiveSessionRecord>;
}

export async function createLiveSession(input: {
  title: string;
  category?: string | null;
  playbackUrl?: string | null;
}): Promise<LiveSessionRecord> {
  const response = await authenticatedFetch("/live", {
    method: "POST",
    body: JSON.stringify(input)
  });
  return response.json() as Promise<LiveSessionRecord>;
}

export async function updateLiveSession(liveId: string, input: {
  title?: string;
  category?: string | null;
  playbackUrl?: string | null;
}): Promise<LiveSessionRecord> {
  const response = await authenticatedFetch(`/live/${encodeURIComponent(liveId)}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
  return response.json() as Promise<LiveSessionRecord>;
}

export async function startLiveSession(liveId: string): Promise<LiveSessionRecord> {
  const response = await authenticatedFetch(`/live/${encodeURIComponent(liveId)}/start`, { method: "POST" });
  return response.json() as Promise<LiveSessionRecord>;
}

export async function endLiveSession(liveId: string): Promise<LiveSessionRecord> {
  const response = await authenticatedFetch(`/live/${encodeURIComponent(liveId)}/end`, { method: "POST" });
  return response.json() as Promise<LiveSessionRecord>;
}

export async function pinLiveOffer(liveId: string, offerType: "SERVICE" | "PRODUCT" | "NONE", offerId?: string | null): Promise<LiveSessionRecord> {
  const response = await authenticatedFetch(`/live/${encodeURIComponent(liveId)}/pin`, {
    method: "POST",
    body: JSON.stringify({ offerType, offerId: offerId ?? null })
  });
  return response.json() as Promise<LiveSessionRecord>;
}

export async function heartbeatLiveViewer(liveId: string) {
  const response = await fetch(`${apiBase}/live/${encodeURIComponent(liveId)}/view`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ viewerKey: getLiveViewerKey() }),
    cache: "no-store"
  });
  if (!response.ok) throw new Error(await parseError(response));
  return response.json() as Promise<{ recorded: true; viewers: number }>;
}

export async function getLiveComments(liveId: string): Promise<LiveCommentRecord[]> {
  const response = await fetch(`${apiBase}/live/${encodeURIComponent(liveId)}/comments`, { cache: "no-store" });
  if (!response.ok) throw new Error(await parseError(response));
  return response.json() as Promise<LiveCommentRecord[]>;
}

export async function createLiveComment(liveId: string, body: string): Promise<LiveCommentRecord> {
  const response = await authenticatedFetch(`/live/${encodeURIComponent(liveId)}/comments`, {
    method: "POST",
    body: JSON.stringify({ body })
  });
  return response.json() as Promise<LiveCommentRecord>;
}

export async function recordLiveEvent(liveId: string, name: LiveEventName) {
  const response = await fetch(`${apiBase}/live/${encodeURIComponent(liveId)}/events`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, viewerKey: getLiveViewerKey() }),
    cache: "no-store"
  });
  if (!response.ok) throw new Error(await parseError(response));
  return response.json() as Promise<{ recorded: true; name: LiveEventName; targetId: string }>;
}

export function formatLiveMoney(priceMinor: number | null, currency = "NGN") {
  if (priceMinor === null) return "Price not set";
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(priceMinor / 100);
}

export function youtubeLiveEmbedUrl(raw: string | null) {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.hostname === "youtu.be") return `https://www.youtube.com/embed/${url.pathname.slice(1)}`;
    if (url.hostname.includes("youtube.com")) {
      const id = url.searchParams.get("v");
      if (id) return `https://www.youtube.com/embed/${id}`;
      const parts = url.pathname.split("/").filter(Boolean);
      const liveIndex = parts.indexOf("live");
      if (liveIndex >= 0 && parts[liveIndex + 1]) return `https://www.youtube.com/embed/${parts[liveIndex + 1]}`;
      const embedIndex = parts.indexOf("embed");
      if (embedIndex >= 0 && parts[embedIndex + 1]) return `https://www.youtube.com/embed/${parts[embedIndex + 1]}`;
    }
  } catch {
    return null;
  }
  return null;
}
