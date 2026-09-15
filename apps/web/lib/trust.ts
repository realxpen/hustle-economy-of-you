"use client";

import { getSupabaseBrowserClient } from "./supabase/client";

export type ReviewSubjectType = "BOOKING" | "ORDER";
export type ReviewPartyRole = "CLIENT" | "HUSTLER" | "BUYER" | "SELLER";
export type ReviewStatus = "PUBLISHED" | "HIDDEN" | "REMOVED";

export interface ReviewEligibilityUser {
  userId: string;
  role: ReviewPartyRole;
  displayName?: string | null;
  username?: string | null;
  avatarUrl?: string | null;
}

export interface ExistingReviewSummary {
  id: string;
  status: ReviewStatus;
  verifiedTransaction: boolean;
  createdAt: string;
}

export interface ReviewEligibility {
  subjectType: ReviewSubjectType;
  subjectId: string;
  eligible: boolean;
  reasonCode: string;
  message: string;
  verifiedTransaction: boolean;
  reviewer: ReviewEligibilityUser;
  reviewee: ReviewEligibilityUser;
  existingReview: ExistingReviewSummary | null;
}

export interface ReviewUser {
  id: string;
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
}

export interface ReviewRecord {
  id: string;
  subjectType: ReviewSubjectType;
  subjectId: string;
  reviewerUserId: string;
  revieweeUserId: string;
  reviewerRole: ReviewPartyRole;
  revieweeRole: ReviewPartyRole;
  rating: number;
  body: string;
  status: ReviewStatus;
  verifiedTransaction: boolean;
  verifiedAt: string;
  createdAt: string;
  updatedAt: string;
  reviewer: ReviewUser;
  reviewee: ReviewUser;
  context:
    | { kind: "SERVICE"; serviceId: string; title: string }
    | {
        kind: "PRODUCT_ORDER";
        totalMinor: number;
        currency: string;
        items: Array<{
          productId: string;
          title: string;
          variantName: string | null;
          quantity: number;
        }>;
      }
    | null;
}

export interface UserReputation {
  userId: string;
  ratingSum: number;
  reviewCount: number;
  verifiedReviewCount: number;
  bookingReviewCount: number;
  orderReviewCount: number;
  lastReviewAt: string | null;
  averageRating: number | null;
}

export interface CreateReviewResult {
  review: ReviewRecord;
  reputation: UserReputation;
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

export async function getReviewEligibility(subjectType: ReviewSubjectType, subjectId: string) {
  const response = await authenticatedFetch(
    `/reviews/eligibility/${subjectType}/${encodeURIComponent(subjectId)}`
  );
  return response.json() as Promise<ReviewEligibility>;
}

export async function createReview(input: {
  subjectType: ReviewSubjectType;
  subjectId: string;
  rating: number;
  body: string;
}) {
  const response = await authenticatedFetch("/reviews", {
    method: "POST",
    body: JSON.stringify(input)
  });
  return response.json() as Promise<CreateReviewResult>;
}

export async function getReview(reviewId: string) {
  const response = await authenticatedFetch(`/reviews/${encodeURIComponent(reviewId)}`);
  return response.json() as Promise<ReviewRecord>;
}

export async function listGivenReviews(limit = 20, cursor?: string) {
  const query = new URLSearchParams({ limit: String(limit) });
  if (cursor) query.set("cursor", cursor);
  const response = await authenticatedFetch(`/reviews/me/given?${query.toString()}`);
  return response.json() as Promise<{ items: ReviewRecord[]; nextCursor: string | null; hasMore: boolean }>;
}

export async function listReceivedReviews(userId: string, limit = 20, cursor?: string) {
  const query = new URLSearchParams({ limit: String(limit) });
  if (cursor) query.set("cursor", cursor);
  const response = await authenticatedFetch(
    `/reviews/users/${encodeURIComponent(userId)}/received?${query.toString()}`
  );
  return response.json() as Promise<{ items: ReviewRecord[]; nextCursor: string | null; hasMore: boolean }>;
}

export async function getUserReputation(userId: string) {
  const response = await authenticatedFetch(`/reviews/users/${encodeURIComponent(userId)}/reputation`);
  return response.json() as Promise<{ user: ReviewUser; reputation: UserReputation }>;
}

export function revieweeLabel(eligibility: ReviewEligibility) {
  return eligibility.reviewee.displayName
    ?? (eligibility.reviewee.username ? `@${eligibility.reviewee.username}` : "this Hustle user");
}
