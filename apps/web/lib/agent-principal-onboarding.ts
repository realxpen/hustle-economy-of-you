"use client";

import type {
  AgentPermissionGrant,
  HustleCapability,
  HustlerApplication,
  HustlerApplicationProof,
  HustlerProofType,
  SaveHustlerApplicationInput
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

export interface DelegatedHustlerProof extends HustlerApplicationProof {
  agentCanRemove: boolean;
}

export interface DelegatedHustlerApplication
  extends Omit<HustlerApplication, "proofs"> {
  proofs: DelegatedHustlerProof[];
}

export interface AgentPrincipalOnboardingView {
  relationshipId: string;
  permissions: AgentPermissionGrant[];
  principal: {
    id: string;
    displayName: string | null;
    username: string | null;
    bio: string | null;
    location: string | null;
    avatarUrl: string | null;
    onboardingCompleted: boolean;
    capabilities: HustleCapability[];
    hustlerApplication: DelegatedHustlerApplication | null;
  };
}

export interface UpdateAgentPrincipalIdentityInput {
  displayName?: string | null;
  username?: string | null;
  location?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
}

const base = (principalUserId: string) =>
  `/agent-principal-onboarding/${encodeURIComponent(principalUserId)}`;

async function json<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

export async function getAgentPrincipalOnboarding(
  principalUserId: string
): Promise<AgentPrincipalOnboardingView> {
  return json(await authenticatedFetch(base(principalUserId)));
}

export async function updateAgentPrincipalIdentity(
  principalUserId: string,
  input: UpdateAgentPrincipalIdentityInput
): Promise<AgentPrincipalOnboardingView> {
  return json(await authenticatedFetch(`${base(principalUserId)}/identity`, {
    method: "PATCH",
    body: JSON.stringify(input)
  }));
}

export async function saveAgentPrincipalHustlerApplication(
  principalUserId: string,
  input: SaveHustlerApplicationInput
): Promise<AgentPrincipalOnboardingView> {
  return json(await authenticatedFetch(
    `${base(principalUserId)}/hustler-application`,
    {
      method: "PUT",
      body: JSON.stringify(input)
    }
  ));
}

export async function uploadAgentPrincipalHustlerProof(
  principalUserId: string,
  file: File,
  type: HustlerProofType
): Promise<AgentPrincipalOnboardingView> {
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

  const safeName =
    file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120) || "proof";
  const storageKey =
    `${session.user.id}/delegated/${principalUserId}/${crypto.randomUUID()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(proofBucket)
    .upload(storageKey, file, {
      contentType: file.type,
      upsert: false
    });

  if (uploadError) throw new Error(uploadError.message);

  try {
    return json(await authenticatedFetch(
      `${base(principalUserId)}/hustler-application/proofs`,
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
    ));
  } catch (reason) {
    await supabase.storage.from(proofBucket).remove([storageKey]).catch(() => undefined);
    throw reason;
  }
}

export async function removeAgentPrincipalHustlerProof(
  principalUserId: string,
  proof: DelegatedHustlerProof
): Promise<AgentPrincipalOnboardingView> {
  if (!proof.agentCanRemove) {
    throw new Error("Only the Agent who uploaded this proof can remove it");
  }

  const updated = await json<AgentPrincipalOnboardingView>(
    await authenticatedFetch(
      `${base(principalUserId)}/hustler-application/proofs/${encodeURIComponent(proof.id)}`,
      { method: "DELETE" }
    )
  );

  const supabase = getSupabaseBrowserClient();
  await supabase.storage.from(proofBucket).remove([proof.storageKey]).catch(() => undefined);
  return updated;
}

export async function submitAgentPrincipalHustlerApplication(
  principalUserId: string
): Promise<AgentPrincipalOnboardingView> {
  return json(await authenticatedFetch(
    `${base(principalUserId)}/hustler-application/submit`,
    { method: "POST" }
  ));
}
