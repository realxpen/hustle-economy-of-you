"use client";

import type {
  HustleCapability,
  HustlerApplication,
  HustlerApplicationProof
} from "@hustle/types";
import { getSupabaseBrowserClient } from "./supabase/client";

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export interface HustlerReviewApplicant {
  id: string;
  displayName: string | null;
  username: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  capabilities?: HustleCapability[];
}

export interface HustlerReviewerSummary {
  id: string;
  displayName: string | null;
  username: string | null;
  email: string | null;
}

export interface HustlerReviewRecord extends HustlerApplication {
  user: HustlerReviewApplicant;
  reviewer?: HustlerReviewerSummary | null;
}

export interface ProofReadUrl {
  url: string;
  expiresInSeconds: number;
  proof: Pick<
    HustlerApplicationProof,
    "id" | "fileName" | "type" | "mimeType" | "sizeBytes"
  >;
}

async function authenticatedReviewFetch(path: string, init?: RequestInit) {
  const supabase = getSupabaseBrowserClient();
  const {
    data: { session },
    error
  } = await supabase.auth.getSession();

  if (error || !session?.access_token) {
    throw new Error("Sign in with an authorized reviewer account");
  }

  const headers = new Headers(init?.headers);
  headers.set("authorization", `Bearer ${session.access_token}`);
  if (init?.body) headers.set("content-type", "application/json");

  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers,
    cache: "no-store"
  });

  if (!response.ok) {
    const text = await response.text();
    let message = `Hustle API returned ${response.status}`;

    if (text) {
      try {
        const body = JSON.parse(text) as {
          error?: { message?: string };
          message?: string;
        };
        message = body.error?.message ?? body.message ?? message;
      } catch {
        message = text;
      }
    }

    throw new Error(message);
  }

  return response;
}

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) throw new Error("Hustle API returned an empty response");
  return JSON.parse(text) as T;
}

export async function getHustlerReviewQueue(
  status?: string
): Promise<HustlerReviewRecord[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  const response = await authenticatedReviewFetch(`/hustler-reviews${query}`);
  return readJson<HustlerReviewRecord[]>(response);
}

export async function getHustlerReview(
  applicationId: string
): Promise<HustlerReviewRecord> {
  const response = await authenticatedReviewFetch(
    `/hustler-reviews/${encodeURIComponent(applicationId)}`
  );
  return readJson<HustlerReviewRecord>(response);
}

export async function startHustlerReview(
  applicationId: string
): Promise<HustlerReviewRecord> {
  const response = await authenticatedReviewFetch(
    `/hustler-reviews/${encodeURIComponent(applicationId)}/start`,
    { method: "POST" }
  );
  return readJson<HustlerReviewRecord>(response);
}

export async function setHustlerVerification(
  applicationId: string,
  status: "VERIFIED" | "REJECTED"
): Promise<HustlerReviewRecord> {
  const response = await authenticatedReviewFetch(
    `/hustler-reviews/${encodeURIComponent(applicationId)}/verification`,
    {
      method: "POST",
      body: JSON.stringify({ status })
    }
  );
  return readJson<HustlerReviewRecord>(response);
}

export async function getHustlerProofReadUrl(
  applicationId: string,
  proofId: string
): Promise<ProofReadUrl> {
  const response = await authenticatedReviewFetch(
    `/hustler-reviews/${encodeURIComponent(applicationId)}/proofs/${encodeURIComponent(proofId)}/read-url`,
    { method: "POST" }
  );
  return readJson<ProofReadUrl>(response);
}

export async function approveHustlerApplication(
  applicationId: string,
  notes?: string
): Promise<HustlerReviewRecord> {
  const response = await authenticatedReviewFetch(
    `/hustler-reviews/${encodeURIComponent(applicationId)}/approve`,
    {
      method: "POST",
      body: JSON.stringify({ notes: notes || null })
    }
  );
  return readJson<HustlerReviewRecord>(response);
}

export async function rejectHustlerApplication(
  applicationId: string,
  rejectionReason: string,
  notes?: string
): Promise<HustlerReviewRecord> {
  const response = await authenticatedReviewFetch(
    `/hustler-reviews/${encodeURIComponent(applicationId)}/reject`,
    {
      method: "POST",
      body: JSON.stringify({
        rejectionReason,
        notes: notes || null
      })
    }
  );
  return readJson<HustlerReviewRecord>(response);
}
