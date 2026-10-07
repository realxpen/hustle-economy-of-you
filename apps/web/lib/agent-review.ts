"use client";

import type {
  AgentApplication,
  AgentApplicationProof,
  HustleCapability
} from "@hustle/types";
import { authenticatedFetch } from "./api/authenticated-fetch";

export interface AgentReviewApplicant {
  id: string;
  displayName: string | null;
  username: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  capabilities?: HustleCapability[];
}

export interface AgentReviewerSummary {
  id: string;
  displayName: string | null;
  username: string | null;
  email: string | null;
}

export interface AgentReviewRecord extends AgentApplication {
  user: AgentReviewApplicant;
  reviewer?: AgentReviewerSummary | null;
}

export interface AgentProofReadUrl {
  url: string;
  expiresInSeconds: number;
  proof: Pick<
    AgentApplicationProof,
    "id" | "fileName" | "type" | "mimeType" | "sizeBytes"
  >;
}

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text.trim()) throw new Error("Hustle API returned an empty response");
  return JSON.parse(text) as T;
}

export async function getAgentReviewQueue(
  status?: string
): Promise<AgentReviewRecord[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return readJson<AgentReviewRecord[]>(
    await authenticatedFetch(`/admin/agent-applications${query}`)
  );
}

export async function getAgentReview(
  applicationId: string
): Promise<AgentReviewRecord> {
  return readJson<AgentReviewRecord>(
    await authenticatedFetch(
      `/admin/agent-applications/${encodeURIComponent(applicationId)}`
    )
  );
}

export async function startAgentReview(
  applicationId: string
): Promise<AgentReviewRecord> {
  return readJson<AgentReviewRecord>(
    await authenticatedFetch(
      `/admin/agent-applications/${encodeURIComponent(applicationId)}/start`,
      { method: "POST" }
    )
  );
}

export async function setAgentVerification(
  applicationId: string,
  status: "VERIFIED" | "REJECTED"
): Promise<AgentReviewRecord> {
  return readJson<AgentReviewRecord>(
    await authenticatedFetch(
      `/admin/agent-applications/${encodeURIComponent(applicationId)}/verification`,
      {
        method: "POST",
        body: JSON.stringify({ status })
      }
    )
  );
}

export async function getAgentProofReadUrl(
  applicationId: string,
  proofId: string
): Promise<AgentProofReadUrl> {
  return readJson<AgentProofReadUrl>(
    await authenticatedFetch(
      `/admin/agent-applications/${encodeURIComponent(applicationId)}/proofs/${encodeURIComponent(proofId)}/read-url`,
      { method: "POST" }
    )
  );
}

export async function approveAgentApplication(
  applicationId: string,
  notes?: string
): Promise<AgentReviewRecord> {
  return readJson<AgentReviewRecord>(
    await authenticatedFetch(
      `/admin/agent-applications/${encodeURIComponent(applicationId)}/approve`,
      {
        method: "POST",
        body: JSON.stringify({ notes: notes || null })
      }
    )
  );
}

export async function rejectAgentApplication(
  applicationId: string,
  rejectionReason: string,
  notes?: string
): Promise<AgentReviewRecord> {
  return readJson<AgentReviewRecord>(
    await authenticatedFetch(
      `/admin/agent-applications/${encodeURIComponent(applicationId)}/reject`,
      {
        method: "POST",
        body: JSON.stringify({
          rejectionReason,
          notes: notes || null
        })
      }
    )
  );
}
