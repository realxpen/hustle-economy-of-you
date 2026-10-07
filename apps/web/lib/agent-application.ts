"use client";

import type {
  AgentApplication,
  AgentApplicationProof,
  AgentProofType,
  SaveAgentApplicationInput
} from "@hustle/types";
import { authenticatedFetch, getAuthenticatedUserId } from "./api/authenticated-fetch";
import { getSupabaseBrowserClient } from "./supabase/client";

const proofBucket = "agent-proofs";
const maxProofBytes = 10 * 1024 * 1024;
const allowedMimeTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp"
]);

async function readJson<T>(response: Response, emptyValue?: T): Promise<T> {
  const text = await response.text();
  if (!text.trim()) {
    if (emptyValue !== undefined) return emptyValue;
    throw new Error(`Hustle API returned an empty response (${response.status})`);
  }
  return JSON.parse(text) as T;
}

export async function getMyAgentApplication(): Promise<AgentApplication | null> {
  const response = await authenticatedFetch("/agent-application");
  return readJson<AgentApplication | null>(response, null);
}

export async function saveMyAgentApplication(
  input: SaveAgentApplicationInput
): Promise<AgentApplication> {
  const response = await authenticatedFetch("/agent-application", {
    method: "PUT",
    body: JSON.stringify(input)
  });
  return readJson<AgentApplication>(response);
}

export async function uploadMyAgentProof(
  file: File,
  type: AgentProofType
): Promise<AgentApplication> {
  if (!allowedMimeTypes.has(file.type)) {
    throw new Error("Proof must be a PDF, JPEG, PNG or WebP file");
  }
  if (file.size <= 0 || file.size > maxProofBytes) {
    throw new Error("Proof file must be no larger than 10 MB");
  }

  const userId = await getAuthenticatedUserId();
  const supabase = getSupabaseBrowserClient();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120) || "proof";
  const storageKey = `${userId}/applications/${crypto.randomUUID()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(proofBucket)
    .upload(storageKey, file, {
      contentType: file.type,
      upsert: false
    });

  if (uploadError) throw new Error(uploadError.message);

  try {
    const response = await authenticatedFetch("/agent-application/proofs", {
      method: "POST",
      body: JSON.stringify({
        type,
        storageKey,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size
      })
    });
    return readJson<AgentApplication>(response);
  } catch (error) {
    await supabase.storage.from(proofBucket).remove([storageKey]).catch(() => undefined);
    throw error;
  }
}

export async function removeMyAgentProof(
  proof: AgentApplicationProof
): Promise<AgentApplication> {
  const response = await authenticatedFetch(
    `/agent-application/proofs/${encodeURIComponent(proof.id)}`,
    { method: "DELETE" }
  );
  const application = await readJson<AgentApplication>(response);

  const { error } = await getSupabaseBrowserClient()
    .storage
    .from(proofBucket)
    .remove([proof.storageKey]);

  if (error) {
    console.warn("Hustle Agent proof metadata removed but storage cleanup failed", error.message);
  }

  return application;
}

export async function submitMyAgentApplication(): Promise<AgentApplication> {
  const response = await authenticatedFetch("/agent-application/submit", {
    method: "POST"
  });
  return readJson<AgentApplication>(response);
}
