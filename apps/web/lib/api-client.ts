"use client";

import { getSupabaseBrowserClient } from "./supabase/client";

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

let cachedAuth: { accessToken: string; expiresAtMs: number } | null = null;
let authListenerAttached = false;
let sessionPromise: Promise<string> | null = null;

export function apiUrl(path: string) {
  return `${apiBase}${path}`;
}

export async function parseApiError(response: Response) {
  const body = await response.json().catch(() => null) as {
    error?: { message?: string };
    message?: string;
  } | null;
  return body?.error?.message ?? body?.message ?? `Hustle API returned ${response.status}`;
}

function cacheSession(session: { access_token: string; expires_at?: number } | null) {
  if (!session?.access_token) {
    cachedAuth = null;
    return;
  }

  cachedAuth = {
    accessToken: session.access_token,
    expiresAtMs: session.expires_at ? session.expires_at * 1000 : Date.now() + 60_000
  };
}

function ensureAuthListener() {
  if (authListenerAttached) return;
  authListenerAttached = true;
  const supabase = getSupabaseBrowserClient();
  supabase.auth.onAuthStateChange((_event, session) => cacheSession(session));
}

export function clearCachedApiAuth() {
  cachedAuth = null;
  sessionPromise = null;
}

export async function getApiAccessToken() {
  ensureAuthListener();
  if (cachedAuth && cachedAuth.expiresAtMs - Date.now() > 30_000) {
    return cachedAuth.accessToken;
  }

  if (sessionPromise) return sessionPromise;

  sessionPromise = (async () => {
    const supabase = getSupabaseBrowserClient();
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session?.access_token) throw new Error("You need to sign in again");
    cacheSession(session);
    return session.access_token;
  })();

  try {
    return await sessionPromise;
  } finally {
    sessionPromise = null;
  }
}

export async function authenticatedApiFetch(
  path: string,
  init?: RequestInit,
  retryOnUnauthorized = true
): Promise<Response> {
  const accessToken = await getApiAccessToken();
  const headers = new Headers(init?.headers);
  headers.set("authorization", `Bearer ${accessToken}`);
  if (init?.body && !headers.has("content-type")) headers.set("content-type", "application/json");

  const response = await fetch(apiUrl(path), {
    ...init,
    headers,
    cache: init?.cache ?? "no-store"
  });

  if (response.status === 401 && retryOnUnauthorized) {
    clearCachedApiAuth();
    return authenticatedApiFetch(path, init, false);
  }
  if (!response.ok) throw new Error(await parseApiError(response));
  return response;
}
