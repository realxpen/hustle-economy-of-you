"use client";

import { getSupabaseBrowserClient } from "./supabase/client";
import type { ReviewPartyRole, ReviewSubjectType, ReviewUser } from "./trust";

export type CounterpartyFeedbackIssue =
  | "NO_SHOW"
  | "ABUSIVE_BEHAVIOR"
  | "SCOPE_MANIPULATION"
  | "REPEATED_CANCELLATION"
  | "FRAUD_SUSPICIOUS"
  | "DISPUTE_ABUSE"
  | "COMMUNICATION_PROBLEMS"
  | "PAYMENT_ABUSE"
  | "OTHER";

export interface ExistingCounterpartyFeedback {
  id: string;
  createdAt: string;
}

export interface CounterpartyFeedbackEligibility {
  subjectType: ReviewSubjectType;
  subjectId: string;
  eligible: boolean;
  reasonCode: string;
  message: string;
  transactionBacked: boolean;
  transactionStatus: string;
  author: {
    userId: string;
    role: ReviewPartyRole;
  };
  target: ReviewUser & {
    role: ReviewPartyRole;
  };
  existingFeedback: ExistingCounterpartyFeedback | null;
}

export interface CounterpartyFeedbackRecord {
  id: string;
  subjectType: ReviewSubjectType;
  subjectId: string;
  authorUserId: string;
  targetUserId: string;
  authorRole: ReviewPartyRole;
  targetRole: ReviewPartyRole;
  wouldWorkAgain: boolean;
  experienceRating: number | null;
  issueCategories: CounterpartyFeedbackIssue[];
  privateNote: string | null;
  transactionStatusSnapshot: string;
  createdAt: string;
  updatedAt: string;
  target: ReviewUser;
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

export async function getCounterpartyFeedbackEligibility(
  subjectType: ReviewSubjectType,
  subjectId: string
) {
  const response = await authenticatedFetch(
    `/trust-safety/feedback/eligibility/${subjectType}/${encodeURIComponent(subjectId)}`
  );
  return response.json() as Promise<CounterpartyFeedbackEligibility>;
}

export async function createCounterpartyFeedback(input: {
  subjectType: ReviewSubjectType;
  subjectId: string;
  wouldWorkAgain: boolean;
  experienceRating?: number;
  issueCategories: CounterpartyFeedbackIssue[];
  privateNote?: string;
}) {
  const response = await authenticatedFetch("/trust-safety/feedback", {
    method: "POST",
    body: JSON.stringify(input)
  });
  return response.json() as Promise<CounterpartyFeedbackRecord>;
}
