"use client";

import { getSupabaseBrowserClient } from "./supabase/client";

export type StoryType = "TEXT" | "IMAGE" | "VIDEO";

export interface StoryCreator {
  id: string;
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
  location: string | null;
  verified: boolean;
  professionalProfile: {
    headline: string | null;
    primarySkill: string | null;
    published: boolean;
  } | null;
}

export interface StoryServiceAttachment {
  id: string;
  title: string | null;
  category: string | null;
  priceMinor: number | null;
  currency: string;
  pricingType: "FIXED" | "STARTING_AT" | "HOURLY";
  deliveryMode: "REMOTE" | "PHYSICAL" | "BOTH";
}

export interface StoryProductAttachment {
  id: string;
  title: string | null;
  category: string | null;
  priceMinor: number | null;
  currency: string;
  type: "PHYSICAL" | "DIGITAL";
  trackInventory: boolean;
  inventoryQuantity: number | null;
}

export interface StoryRecord {
  id: string;
  userId: string;
  type: StoryType;
  text: string | null;
  mediaUrl: string | null;
  background: string | null;
  serviceId: string | null;
  productId: string | null;
  publishedAt: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  active: boolean;
  remainingMs: number;
  creator: StoryCreator;
  service: StoryServiceAttachment | null;
  product: StoryProductAttachment | null;
}

export interface CreateStoryInput {
  type: StoryType;
  text?: string | null;
  mediaUrl?: string | null;
  background?: string | null;
  serviceId?: string | null;
  productId?: string | null;
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

export async function getActiveStories(limit = 60): Promise<StoryRecord[]> {
  const response = await fetch(`${apiBase}/stories?limit=${limit}`, { cache: "no-store" });
  if (!response.ok) throw new Error(await parseError(response));
  return response.json() as Promise<StoryRecord[]>;
}

export async function getPublicStory(storyId: string): Promise<StoryRecord> {
  const response = await fetch(`${apiBase}/stories/${encodeURIComponent(storyId)}`, { cache: "no-store" });
  if (!response.ok) {
    if (response.status === 404) throw new Error("This Story has expired or is unavailable.");
    throw new Error(await parseError(response));
  }
  return response.json() as Promise<StoryRecord>;
}

export async function getMyStories(): Promise<StoryRecord[]> {
  const response = await authenticatedFetch("/stories/mine");
  return response.json() as Promise<StoryRecord[]>;
}

export async function createStory(input: CreateStoryInput): Promise<StoryRecord> {
  const response = await authenticatedFetch("/stories", {
    method: "POST",
    body: JSON.stringify(input)
  });
  return response.json() as Promise<StoryRecord>;
}

export async function deleteStory(storyId: string): Promise<{ deleted: true; id: string }> {
  const response = await authenticatedFetch(`/stories/${encodeURIComponent(storyId)}`, {
    method: "DELETE"
  });
  return response.json() as Promise<{ deleted: true; id: string }>;
}

export function formatStoryRemaining(expiresAt: string) {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "Expired";
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.max(1, Math.floor((ms % 3_600_000) / 60_000));
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}
