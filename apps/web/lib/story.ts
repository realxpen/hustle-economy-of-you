"use client";

import { getSupabaseBrowserClient } from "./supabase/client";

export type StoryType = "TEXT" | "IMAGE" | "VIDEO";
export type StoryReaction = "HEART" | "FIRE" | "CLAP" | "HUNDRED";
export type StoryEventName = "PROFILE_CLICKED" | "SERVICE_CLICKED" | "PRODUCT_CLICKED";

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

export interface StoryMention {
  id: string;
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
  location: string | null;
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

export interface StoryInteractions {
  views: number;
  replies: number;
  reactions: Partial<Record<StoryReaction, number>>;
}

export interface StoryRecord {
  id: string;
  userId: string;
  type: StoryType;
  text: string | null;
  mediaUrl: string | null;
  mediaStorageKey: string | null;
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
  mentions: StoryMention[];
  service: StoryServiceAttachment | null;
  product: StoryProductAttachment | null;
  interactions: StoryInteractions;
}

export interface CreateStoryInput {
  type: StoryType;
  text?: string | null;
  mediaUrl?: string | null;
  mediaStorageKey?: string | null;
  background?: string | null;
  serviceId?: string | null;
  productId?: string | null;
}

export interface StoryViewerInteraction {
  viewerUserId: string;
  isOwner: boolean;
  reaction: StoryReaction | null;
  ownReplyCount: number;
}

export interface StoryReply {
  id: string;
  storyId: string;
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
const storyMediaBucket = "story-media";
const imageMimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const videoMimeTypes = new Set(["video/mp4", "video/webm", "video/quicktime"]);

async function parseError(response: Response) {
  const body = await response.json().catch(() => null) as {
    error?: { message?: string };
    message?: string;
  } | null;
  return body?.error?.message ?? body?.message ?? `Hustle API returned ${response.status}`;
}

async function getSession() {
  const supabase = getSupabaseBrowserClient();
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.access_token || !session.user) throw new Error("You need to sign in again");
  return { supabase, session };
}

async function authenticatedFetch(path: string, init?: RequestInit) {
  const { session } = await getSession();
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

function emptyInteractions(): StoryInteractions {
  return { views: 0, replies: 0, reactions: {} };
}

function normalizeStory(story: StoryRecord): StoryRecord {
  return {
    ...story,
    mentions: story.mentions ?? [],
    interactions: story.interactions ?? emptyInteractions()
  };
}

export function getStoryViewerKey() {
  if (typeof window === "undefined") return "server:story-viewer";
  const key = "hustle.story.viewerKey";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const next = `web:${crypto.randomUUID()}`;
  window.localStorage.setItem(key, next);
  return next;
}

export async function getActiveStories(limit = 60): Promise<StoryRecord[]> {
  const response = await fetch(`${apiBase}/stories?limit=${limit}`, { cache: "no-store" });
  if (!response.ok) throw new Error(await parseError(response));
  const stories = await response.json() as StoryRecord[];
  return stories.map(normalizeStory);
}

export async function getPublicStory(storyId: string): Promise<StoryRecord> {
  const response = await fetch(`${apiBase}/stories/${encodeURIComponent(storyId)}`, { cache: "no-store" });
  if (!response.ok) {
    if (response.status === 404) throw new Error("This Story has expired or is unavailable.");
    throw new Error(await parseError(response));
  }
  return normalizeStory(await response.json() as StoryRecord);
}

export async function getMyStories(): Promise<StoryRecord[]> {
  const response = await authenticatedFetch("/stories/mine");
  const stories = await response.json() as StoryRecord[];
  return stories.map(normalizeStory);
}

export async function uploadStoryMedia(file: File, type: Exclude<StoryType, "TEXT">) {
  const allowed = type === "IMAGE" ? imageMimeTypes : videoMimeTypes;
  const maxBytes = type === "IMAGE" ? 10 * 1024 * 1024 : 50 * 1024 * 1024;
  if (!allowed.has(file.type)) {
    throw new Error(type === "IMAGE"
      ? "Story image must be JPEG, PNG, WebP or GIF"
      : "Story video must be MP4, WebM or QuickTime");
  }
  if (file.size <= 0 || file.size > maxBytes) {
    throw new Error(type === "IMAGE" ? "Story image must be no larger than 10 MB" : "Story video must be no larger than 50 MB");
  }

  const { supabase, session } = await getSession();
  const extension = file.name.includes(".") ? file.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "") : undefined;
  const safeExtension = extension ? `.${extension.slice(0, 10)}` : "";
  const storageKey = `${session.user.id}/stories/${crypto.randomUUID()}${safeExtension}`;
  const { error } = await supabase.storage.from(storyMediaBucket).upload(storageKey, file, {
    contentType: file.type,
    upsert: false,
    cacheControl: "3600"
  });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from(storyMediaBucket).getPublicUrl(storageKey);
  return { mediaStorageKey: storageKey, mediaUrl: data.publicUrl };
}

export async function removeStoryMedia(storageKey: string) {
  const { supabase } = await getSession();
  const { error } = await supabase.storage.from(storyMediaBucket).remove([storageKey]);
  if (error) throw new Error(error.message);
}

export async function createStory(input: CreateStoryInput): Promise<StoryRecord> {
  const response = await authenticatedFetch("/stories", {
    method: "POST",
    body: JSON.stringify(input)
  });
  return normalizeStory(await response.json() as StoryRecord);
}

export async function deleteStory(storyId: string): Promise<{ deleted: true; id: string; mediaStorageKey: string | null }> {
  const response = await authenticatedFetch(`/stories/${encodeURIComponent(storyId)}`, {
    method: "DELETE"
  });
  return response.json() as Promise<{ deleted: true; id: string; mediaStorageKey: string | null }>;
}

export async function recordStoryView(storyId: string) {
  const response = await fetch(`${apiBase}/stories/${encodeURIComponent(storyId)}/views`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ viewerKey: getStoryViewerKey() }),
    cache: "no-store"
  });
  if (!response.ok) throw new Error(await parseError(response));
  return response.json() as Promise<{ recorded: true; unique: boolean; views: number }>;
}

export async function getStoryInteractions(storyId: string): Promise<StoryInteractions> {
  const response = await fetch(`${apiBase}/stories/${encodeURIComponent(storyId)}/interactions`, { cache: "no-store" });
  if (!response.ok) throw new Error(await parseError(response));
  return response.json() as Promise<StoryInteractions>;
}

export async function getMyStoryInteraction(storyId: string): Promise<StoryViewerInteraction | null> {
  const supabase = getSupabaseBrowserClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return null;
  const response = await fetch(`${apiBase}/stories/${encodeURIComponent(storyId)}/interactions/me`, {
    headers: { authorization: `Bearer ${session.access_token}` },
    cache: "no-store"
  });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error(await parseError(response));
  return response.json() as Promise<StoryViewerInteraction>;
}

export async function reactToStory(storyId: string, reaction: StoryReaction) {
  const response = await authenticatedFetch(`/stories/${encodeURIComponent(storyId)}/reaction`, {
    method: "POST",
    body: JSON.stringify({ reaction })
  });
  return response.json() as Promise<StoryViewerInteraction & { summary: StoryInteractions }>;
}

export async function removeStoryReaction(storyId: string) {
  const response = await authenticatedFetch(`/stories/${encodeURIComponent(storyId)}/reaction`, { method: "DELETE" });
  return response.json() as Promise<StoryViewerInteraction & { summary: StoryInteractions }>;
}

export async function replyToStory(storyId: string, body: string): Promise<StoryReply> {
  const response = await authenticatedFetch(`/stories/${encodeURIComponent(storyId)}/replies`, {
    method: "POST",
    body: JSON.stringify({ body })
  });
  return response.json() as Promise<StoryReply>;
}

export async function getStoryReplies(storyId: string): Promise<{ isOwner: boolean; items: StoryReply[] }> {
  const response = await authenticatedFetch(`/stories/${encodeURIComponent(storyId)}/replies`);
  return response.json() as Promise<{ isOwner: boolean; items: StoryReply[] }>;
}

export async function recordStoryEvent(storyId: string, name: StoryEventName) {
  const response = await fetch(`${apiBase}/stories/${encodeURIComponent(storyId)}/events`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, viewerKey: getStoryViewerKey() }),
    cache: "no-store",
    keepalive: true
  });
  if (!response.ok) throw new Error(await parseError(response));
  return response.json() as Promise<{ recorded: true; name: StoryEventName; targetId: string }>;
}

export function formatStoryRemaining(expiresAt: string) {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "Expired";
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.max(1, Math.floor((ms % 3_600_000) / 60_000));
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}
