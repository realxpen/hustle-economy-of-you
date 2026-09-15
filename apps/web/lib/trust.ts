"use client";

import { getSupabaseBrowserClient } from "./supabase/client";

export type ReviewSubjectType = "BOOKING" | "ORDER";
export type ReviewPartyRole = "CLIENT" | "HUSTLER" | "BUYER" | "SELLER";

export interface ReviewEligibilityUser {
  userId: string;
  role: ReviewPartyRole;
  displayName?: string | null;
  username?: string | null;
  avatarUrl?: string | null;
}

export interface ExistingReviewSummary {
  id: string;
  rating: number;
  status: string;
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

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

async function parseError(response: Response) {
  const body = await response.json().catch(() => null) as {
    error?: { message?: string };
    message?: string;
  } | null;
  return body?.error?.message ?? body?.message ?? `Hustle API returned ${response.status}`;
}

async function authenticatedFetch(path: string) {
  const supabase = getSupabaseBrowserClient();
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.access_token) throw new Error("You need to sign in again");

  const response = await fetch(`${apiBase}${path}`, {
    headers: { authorization: `Bearer ${session.access_token}` },
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

export function revieweeLabel(eligibility: ReviewEligibility) {
  return eligibility.reviewee.displayName
    ?? (eligibility.reviewee.username ? `@${eligibility.reviewee.username}` : "this Hustle user");
}
