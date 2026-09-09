"use client";

import type { Product, Service } from "@hustle/types";
import { getSupabaseBrowserClient } from "./supabase/client";

export type PostStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type PostMediaType = "IMAGE" | "VIDEO";

export interface PostMedia {
  id: string;
  postId: string;
  type: PostMediaType;
  storageKey: string | null;
  mediaUrl: string | null;
  position: number;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  createdAt: string;
}

export interface PostServiceAttachment {
  postId: string;
  serviceId: string;
  createdAt: string;
  service: Service;
}

export interface PostProductAttachment {
  postId: string;
  productId: string;
  createdAt: string;
  product: Product;
}

export interface Post {
  id: string;
  professionalProfileId: string;
  caption: string | null;
  category: string | null;
  location: string | null;
  tags: string[];
  status: PostStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  media: PostMedia[];
  serviceAttachments: PostServiceAttachment[];
  productAttachments: PostProductAttachment[];
}

export interface SavePostInput {
  caption?: string | null;
  category?: string | null;
  location?: string | null;
  tags?: string[];
}

export interface AddPostMediaInput {
  type: PostMediaType;
  storageKey?: string | null;
  mediaUrl?: string | null;
  position?: number;
  width?: number | null;
  height?: number | null;
  durationMs?: number | null;
}

export interface PublicPost {
  post: Post;
  owner: {
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

export async function getMyPosts(): Promise<Post[]> {
  const response = await authenticatedFetch("/posts/mine");
  return response.json() as Promise<Post[]>;
}

export async function getMyPost(postId: string): Promise<Post> {
  const response = await authenticatedFetch(`/posts/mine/${encodeURIComponent(postId)}`);
  return response.json() as Promise<Post>;
}

export async function createPost(input: SavePostInput): Promise<Post> {
  const response = await authenticatedFetch("/posts", {
    method: "POST",
    body: JSON.stringify(input)
  });
  return response.json() as Promise<Post>;
}

export async function savePost(postId: string, input: SavePostInput): Promise<Post> {
  const response = await authenticatedFetch(`/posts/${encodeURIComponent(postId)}`, {
    method: "PUT",
    body: JSON.stringify(input)
  });
  return response.json() as Promise<Post>;
}

export async function addPostMedia(postId: string, input: AddPostMediaInput): Promise<Post> {
  const response = await authenticatedFetch(`/posts/${encodeURIComponent(postId)}/media`, {
    method: "POST",
    body: JSON.stringify(input)
  });
  return response.json() as Promise<Post>;
}

export async function removePostMedia(postId: string, mediaId: string): Promise<Post> {
  const response = await authenticatedFetch(`/posts/${encodeURIComponent(postId)}/media/${encodeURIComponent(mediaId)}`, { method: "DELETE" });
  return response.json() as Promise<Post>;
}

export async function attachPostService(postId: string, serviceId: string): Promise<Post> {
  const response = await authenticatedFetch(`/posts/${encodeURIComponent(postId)}/services/${encodeURIComponent(serviceId)}`, { method: "POST" });
  return response.json() as Promise<Post>;
}

export async function detachPostService(postId: string, serviceId: string): Promise<Post> {
  const response = await authenticatedFetch(`/posts/${encodeURIComponent(postId)}/services/${encodeURIComponent(serviceId)}`, { method: "DELETE" });
  return response.json() as Promise<Post>;
}

export async function attachPostProduct(postId: string, productId: string): Promise<Post> {
  const response = await authenticatedFetch(`/posts/${encodeURIComponent(postId)}/products/${encodeURIComponent(productId)}`, { method: "POST" });
  return response.json() as Promise<Post>;
}

export async function detachPostProduct(postId: string, productId: string): Promise<Post> {
  const response = await authenticatedFetch(`/posts/${encodeURIComponent(postId)}/products/${encodeURIComponent(productId)}`, { method: "DELETE" });
  return response.json() as Promise<Post>;
}

export async function publishPost(postId: string): Promise<Post> {
  const response = await authenticatedFetch(`/posts/${encodeURIComponent(postId)}/publish`, { method: "POST" });
  return response.json() as Promise<Post>;
}

export async function archivePost(postId: string): Promise<Post> {
  const response = await authenticatedFetch(`/posts/${encodeURIComponent(postId)}/archive`, { method: "POST" });
  return response.json() as Promise<Post>;
}

export async function getPublicPost(postId: string): Promise<PublicPost> {
  const response = await fetch(`${apiBase}/posts/${encodeURIComponent(postId)}`, { cache: "no-store" });
  if (!response.ok) {
    if (response.status === 404) throw new Error("This post is not currently public.");
    throw new Error(await parseError(response));
  }
  return response.json() as Promise<PublicPost>;
}
