"use client";

import { getSupabaseBrowserClient } from "../supabase/client";

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

type CachedAuth = {
  accessToken: string;
  expiresAtMs: number;
};

let cachedAuth: CachedAuth | null = null;
let authListenerAttached = false;
let sessionPromise: Promise<string> | null = null;

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
  getSupabaseBrowserClient().auth.onAuthStateChange((_event, session) => {
    cacheSession(session);
  });
}

async function resolveAccessToken() {
  ensureAuthListener();

  if (cachedAuth && cachedAuth.expiresAtMs - Date.now() > 30_000) {
    return cachedAuth.accessToken;
  }

  sessionPromise ??= (async () => {
    const { data: { session }, error } = await getSupabaseBrowserClient().auth.getSession();
    if (error || !session?.access_token) throw new Error("You need to sign in again");
    cacheSession(session);
    return session.access_token;
  })().finally(() => {
    sessionPromise = null;
  });

  return sessionPromise;
}

async function parseError(response: Response) {
  const body = await response.json().catch(() => null) as {
    error?: { message?: string };
    message?: string;
  } | null;
  return body?.error?.message ?? body?.message ?? `Hustle API returned ${response.status}`;
}

export async function authenticatedFetch(
  path: string,
  init?: RequestInit,
  retryOnUnauthorized = true
): Promise<Response> {
  const accessToken = await resolveAccessToken();
  const headers = new Headers(init?.headers);
  headers.set("authorization", `Bearer ${accessToken}`);
  if (init?.body) headers.set("content-type", "application/json");

  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers,
    cache: "no-store"
  });

  if (response.status === 401 && retryOnUnauthorized) {
    cachedAuth = null;
    return authenticatedFetch(path, init, false);
  }

  if (!response.ok) throw new Error(await parseError(response));
  return response;
}

export function invalidateAuthenticatedSessionCache() {
  cachedAuth = null;
}
