"use client";

import type {
  ProfessionalProfile,
  PublicProfessionalProfile,
  SaveProfessionalProfileInput
} from "@hustle/types";
import { authenticatedFetch } from "./api/authenticated-fetch";
import { isolatedWebMode } from "./auth/isolated-web-auth";

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

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
  const response = isolatedWebMode
    ? await authenticatedFetch(`/profiles/${encodeURIComponent(username)}`)
    : await fetch(`${apiBase}/profiles/${encodeURIComponent(username)}`, { cache: "no-store" });

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
