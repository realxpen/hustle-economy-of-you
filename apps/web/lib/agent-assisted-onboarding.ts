"use client";

import type {
  AgentAssistedRegistration,
  CreateAgentAssistedRegistrationInput,
  HustlerProofType,
  SaveHustlerApplicationInput,
  UpdateAgentAssistedIdentityInput
} from "@hustle/types";
import { authenticatedFetch } from "./api/authenticated-fetch";
import { getSupabaseBrowserClient } from "./supabase/client";

const proofBucket = "hustler-proofs";
const maxProofBytes = 10 * 1024 * 1024;
const allowedMimeTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp"
]);

export async function listAssistedRegistrations(): Promise<AgentAssistedRegistration[]> {
  const response = await authenticatedFetch("/agent-assisted-onboarding");
  return response.json() as Promise<AgentAssistedRegistration[]>;
}

export async function getAssistedRegistration(
  registrationId: string
): Promise<AgentAssistedRegistration> {
  const response = await authenticatedFetch(
    `/agent-assisted-onboarding/${encodeURIComponent(registrationId)}`
  );
  return response.json() as Promise<AgentAssistedRegistration>;
}

export async function createAssistedRegistration(
  input: CreateAgentAssistedRegistrationInput
): Promise<AgentAssistedRegistration> {
  const response = await authenticatedFetch("/agent-assisted-onboarding", {
    method: "POST",
    body: JSON.stringify(input)
  });
  return response.json() as Promise<AgentAssistedRegistration>;
}

export async function updateAssistedIdentity(
  registrationId: string,
  input: UpdateAgentAssistedIdentityInput
): Promise<AgentAssistedRegistration> {
  const response = await authenticatedFetch(
    `/agent-assisted-onboarding/${encodeURIComponent(registrationId)}/identity`,
    { method: "PATCH", body: JSON.stringify(input) }
  );
  return response.json() as Promise<AgentAssistedRegistration>;
}

export async function saveAssistedHustlerApplication(
  registrationId: string,
  input: SaveHustlerApplicationInput
): Promise<AgentAssistedRegistration> {
  const response = await authenticatedFetch(
    `/agent-assisted-onboarding/${encodeURIComponent(registrationId)}/hustler-application`,
    { method: "PUT", body: JSON.stringify(input) }
  );
  return response.json() as Promise<AgentAssistedRegistration>;
}

export async function uploadAssistedHustlerProof(
  registration: AgentAssistedRegistration,
  file: File,
  type: HustlerProofType
): Promise<AgentAssistedRegistration> {
  if (!allowedMimeTypes.has(file.type)) {
    throw new Error("Proof must be a PDF, JPEG, PNG or WebP file");
  }
  if (file.size <= 0 || file.size > maxProofBytes) {
    throw new Error("Proof file must be no larger than 10 MB");
  }

  const supabase = getSupabaseBrowserClient();
  const {
    data: { session },
    error
  } = await supabase.auth.getSession();

  if (error || !session?.user || !session.access_token) {
    throw new Error("You need to sign in again");
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120) || "proof";
  const storageKey =
    `${session.user.id}/assisted/${registration.principalUserId}/${crypto.randomUUID()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(proofBucket)
    .upload(storageKey, file, {
      contentType: file.type,
      upsert: false
    });

  if (uploadError) throw new Error(uploadError.message);

  try {
    const response = await authenticatedFetch(
      `/agent-assisted-onboarding/${encodeURIComponent(registration.id)}/hustler-application/proofs`,
      {
        method: "POST",
        body: JSON.stringify({
          type,
          storageKey,
          fileName: file.name,
          mimeType: file.type,
          sizeBytes: file.size
        })
      }
    );
    return response.json() as Promise<AgentAssistedRegistration>;
  } catch (reason) {
    await supabase.storage.from(proofBucket).remove([storageKey]).catch(() => undefined);
    throw reason;
  }
}

export async function removeAssistedHustlerProof(
  registration: AgentAssistedRegistration,
  proofId: string,
  storageKey: string
): Promise<AgentAssistedRegistration> {
  const response = await authenticatedFetch(
    `/agent-assisted-onboarding/${encodeURIComponent(registration.id)}/hustler-application/proofs/${encodeURIComponent(proofId)}`,
    { method: "DELETE" }
  );
  const updated = (await response.json()) as AgentAssistedRegistration;

  const supabase = getSupabaseBrowserClient();
  await supabase.storage.from(proofBucket).remove([storageKey]).catch(() => undefined);
  return updated;
}

export async function submitAssistedHustlerApplication(
  registrationId: string
): Promise<AgentAssistedRegistration> {
  const response = await authenticatedFetch(
    `/agent-assisted-onboarding/${encodeURIComponent(registrationId)}/hustler-application/submit`,
    { method: "POST" }
  );
  return response.json() as Promise<AgentAssistedRegistration>;
}
