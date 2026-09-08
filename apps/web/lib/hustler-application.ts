"use client";

import type {
  HustlerApplication,
  SaveHustlerApplicationInput
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
    } | null;
    throw new Error(body?.error?.message ?? `Hustle API returned ${response.status}`);
  }

  return response;
}

export async function getMyHustlerApplication(): Promise<HustlerApplication | null> {
  const response = await authenticatedFetch("/hustler-application");
  return response.json() as Promise<HustlerApplication | null>;
}

export async function saveMyHustlerApplication(
  input: SaveHustlerApplicationInput
): Promise<HustlerApplication> {
  const response = await authenticatedFetch("/hustler-application", {
    method: "PUT",
    body: JSON.stringify(input)
  });
  return response.json() as Promise<HustlerApplication>;
}

export async function submitMyHustlerApplication(): Promise<HustlerApplication> {
  const response = await authenticatedFetch("/hustler-application/submit", {
    method: "POST"
  });
  return response.json() as Promise<HustlerApplication>;
}
