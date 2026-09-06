"use client";

import type { HustleAccount } from "@hustle/types";
import { getSupabaseBrowserClient } from "../supabase/client";

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

async function authenticatedFetch(path: string, init?: RequestInit) {
  const supabase = getSupabaseBrowserClient();
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.access_token) throw new Error("You need to sign in again");

  const headers = new Headers(init?.headers);
  headers.set("authorization", `Bearer ${session.access_token}`);
  if (init?.body) headers.set("content-type", "application/json");

  const response = await fetch(`${apiBase}${path}`, { ...init, headers, cache: "no-store" });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message ?? `Hustle API returned ${response.status}`);
  }
  return response;
}

export async function syncHustleAccount(): Promise<HustleAccount> {
  const response = await authenticatedFetch("/auth/sync", { method: "POST" });
  return response.json() as Promise<HustleAccount>;
}

export async function getMyAccount(): Promise<HustleAccount> {
  const response = await authenticatedFetch("/auth/me");
  return response.json() as Promise<HustleAccount>;
}

export async function updateMyProfile(input: { displayName: string; username: string; bio?: string; location?: string; avatarUrl?: string }): Promise<HustleAccount> {
  const response = await authenticatedFetch("/auth/profile", { method: "PATCH", body: JSON.stringify(input) });
  return response.json() as Promise<HustleAccount>;
}
