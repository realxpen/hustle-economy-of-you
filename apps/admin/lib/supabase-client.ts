"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

function config() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) throw new Error("Hustle Admin authentication is not configured");
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || !parsed.hostname.endsWith(".supabase.co")) {
    throw new Error("Hustle Admin must use the approved Supabase HTTPS project");
  }
  if (!key.startsWith("sb_publishable_") && key.split(".").length !== 3) {
    throw new Error("Invalid Supabase publishable key");
  }
  return { url: parsed.origin, key };
}

// Proxy only Supabase Auth through the same-origin Admin host, just as Hustle Web does.
// No service-role or admin keys are ever sent to the browser.
function authProxyFetch(supabaseOrigin: string): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const requestUrl = input instanceof Request
      ? new URL(input.url)
      : new URL(typeof input === "string" ? input : input.toString());
    if (requestUrl.origin !== supabaseOrigin || !requestUrl.pathname.startsWith("/auth/v1/")) {
      return fetch(input, init);
    }
    const path = requestUrl.pathname.slice("/auth/v1/".length);
    const proxyUrl = new URL(`/api/supabase-auth/${path}`, window.location.origin);
    proxyUrl.search = requestUrl.search;

    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    new Headers(init?.headers).forEach((value, name) => headers.set(name, value));
    return fetch(proxyUrl.toString(), {
      ...(input instanceof Request ? {
        method: input.method,
        body: input.method === "GET" || input.method === "HEAD"
          ? undefined : await input.clone().arrayBuffer(),
        signal: input.signal
      } : {}),
      ...init,
      headers,
      cache: "no-store"
    });
  };
}

export function getAdminSupabaseClient(): SupabaseClient {
  const { url, key } = config();
  client ??= createClient(url, key, {
    auth: {
      storageKey: "hustle-admin-supabase-auth",
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false
    },
    global: { fetch: authProxyFetch(url) }
  });
  return client;
}
