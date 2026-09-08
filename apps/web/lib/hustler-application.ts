"use client";

import type {
  HustlerApplication,
  HustlerApplicationProof,
  HustlerProofType,
  SaveHustlerApplicationInput
} from "@hustle/types";
import { getSupabaseBrowserClient } from "./supabase/client";

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
const proofBucket = "hustler-proofs";
const maxProofBytes = 10 * 1024 * 1024;
const allowedMimeTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp"
]);

async function getSession() {
  const supabase = getSupabaseBrowserClient();
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error || !session?.access_token || !session.user) {
    throw new Error("You need to sign in again");
  }

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

  if (!response.ok) {
    const text = await response.text();
    let message: string | undefined;

    if (text.trim()) {
      try {
        const body = JSON.parse(text) as {
          message?: string;
          error?: { message?: string } | string;
        };
        message = typeof body.error === "object"
          ? body.error?.message
          : body.message ?? (typeof body.error === "string" ? body.error : undefined);
      } catch {
        message = undefined;
      }
    }

    throw new Error(message ?? `Hustle API returned ${response.status}`);
  }

  return response;
}

async function parseJson<T>(response: Response, emptyValue?: T): Promise<T> {
  const text = await response.text();

  if (!text.trim()) {
    if (emptyValue !== undefined) return emptyValue;
    throw new Error(`Hustle API returned an empty response (${response.status})`);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("Hustle API returned an invalid JSON response");
  }
}

export async function getMyHustlerApplication(): Promise<HustlerApplication | null> {
  const response = await authenticatedFetch("/hustler-application");
  return parseJson<HustlerApplication | null>(response, null);
}

export async function saveMyHustlerApplication(
  input: SaveHustlerApplicationInput
): Promise<HustlerApplication> {
  const response = await authenticatedFetch("/hustler-application", {
    method: "PUT",
    body: JSON.stringify(input)
  });
  return parseJson<HustlerApplication>(response);
}

export async function uploadMyHustlerProof(
  file: File,
  type: HustlerProofType
): Promise<HustlerApplication> {
  if (!allowedMimeTypes.has(file.type)) {
    throw new Error("Proof must be a PDF, JPEG, PNG or WebP file");
  }
  if (file.size <= 0 || file.size > maxProofBytes) {
    throw new Error("Proof file must be no larger than 10 MB");
  }

  const { supabase, session } = await getSession();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120) || "proof";
  const storageKey = `${session.user.id}/applications/${crypto.randomUUID()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(proofBucket)
    .upload(storageKey, file, {
      contentType: file.type,
      upsert: false
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  try {
    const response = await authenticatedFetch("/hustler-application/proofs", {
      method: "POST",
      body: JSON.stringify({
        type,
        storageKey,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size
      })
    });
    return parseJson<HustlerApplication>(response);
  } catch (error) {
    await supabase.storage.from(proofBucket).remove([storageKey]).catch(() => undefined);
    throw error;
  }
}

export async function removeMyHustlerProof(
  proof: HustlerApplicationProof
): Promise<HustlerApplication> {
  const response = await authenticatedFetch(
    `/hustler-application/proofs/${encodeURIComponent(proof.id)}`,
    { method: "DELETE" }
  );
  const application = await parseJson<HustlerApplication>(response);

  const { supabase } = await getSession();
  const { error } = await supabase.storage.from(proofBucket).remove([proof.storageKey]);
  if (error) {
    console.warn("Hustle proof metadata removed but storage cleanup failed", error.message);
  }

  return application;
}

export async function submitMyHustlerApplication(): Promise<HustlerApplication> {
  const response = await authenticatedFetch("/hustler-application/submit", {
    method: "POST"
  });
  return parseJson<HustlerApplication>(response);
}
