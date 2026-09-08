"use client";

import type {
  ProfessionalProfile,
  PublicProfessionalProfile,
  SaveProfessionalProfileInput
} from "@hustle/types";
import { getSupabaseBrowserClient } from "./supabase/client";

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

async function authenticatedFetch(path: string, init?: RequestInit) {
  const supabase = getSupabaseBrowserClient();
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.access_token) {
    throw new Error("You need to sign in again");
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
    const body = await response.json().catch(() => null) as {
      error?: { message?: string };
      message?: string;
    } | null;
    throw new Error(
      body?.error?.message ?? body?.message ?? `Hustle API returned ${response.status}`
    );
  }

  return response;
}

export async function getMyProfessionalProfile(): Promise<ProfessionalProfile> {
  const response = await authenticatedFetch("/professional-profile");
  return response.json() as Promise<ProfessionalProfile>;
}

export async function saveMyProfessionalProfile(
  input: SaveProfessionalProfileInput
): Promise<ProfessionalProfile> {
  const response = await authenticatedFetch("/professional-profile", {
    method: "PUT",
    body: JSON.stringify(input)
  });
  return response.json() as Promise<ProfessionalProfile>;
}

export async function publishMyProfessionalProfile(): Promise<ProfessionalProfile> {
  const response = await authenticatedFetch("/professional-profile/publish", {
    method: "POST"
  });
  return response.json() as Promise<ProfessionalProfile>;
}

export async function unpublishMyProfessionalProfile(): Promise<ProfessionalProfile> {
  const response = await authenticatedFetch("/professional-profile/unpublish", {
    method: "POST"
  });
  return response.json() as Promise<ProfessionalProfile>;
}

export async function getPublicProfessionalProfile(
  username: string
): Promise<PublicProfessionalProfile> {
  const response = await fetch(
    `${apiBase}/profiles/${encodeURIComponent(username)}`,
    { cache: "no-store" }
  );

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("This professional profile is not published yet.");
    }
    const body = await response.json().catch(() => null) as {
      error?: { message?: string };
      message?: string;
    } | null;
    throw new Error(
      body?.error?.message ?? body?.message ?? `Hustle API returned ${response.status}`
    );
  }

  return response.json() as Promise<PublicProfessionalProfile>;
}
