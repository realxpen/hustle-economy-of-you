"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

function readSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url || !key) {
    throw new Error("Hustle authentication is not configured yet");
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not a valid URL");
  }

  if (parsed.protocol !== "https:" || !parsed.hostname.endsWith(".supabase.co")) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must be the Hustle Supabase HTTPS project URL");
  }

  const looksPublishable = key.startsWith("sb_publishable_") || key.split(".").length === 3;
  if (!looksPublishable) {
    throw new Error("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY does not look like a valid Supabase publishable key");
  }

  return { url: parsed.origin, key };
}

function createAuthAwareFetch(supabaseOrigin: string): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const requestUrl = input instanceof Request
      ? new URL(input.url)
      : new URL(typeof input === "string" ? input : input.toString());

    if (
      typeof window !== "undefined" &&
      requestUrl.origin === supabaseOrigin &&
      requestUrl.pathname.startsWith("/auth/v1/")
    ) {
      const suffix = requestUrl.pathname.slice("/auth/v1/".length);
      const proxyUrl = new URL(`/api/supabase-auth/${suffix}`, window.location.origin);
      proxyUrl.search = requestUrl.search;

      const headers = new Headers(input instanceof Request ? input.headers : undefined);
      new Headers(init?.headers).forEach((value, key) => headers.set(key, value));

      return window.fetch(proxyUrl.toString(), {
        ...(input instanceof Request
          ? {
              method: input.method,
              body: input.method === "GET" || input.method === "HEAD" ? undefined : await input.clone().arrayBuffer(),
              credentials: input.credentials,
              cache: input.cache,
              redirect: input.redirect,
              referrer: input.referrer,
              referrerPolicy: input.referrerPolicy,
              integrity: input.integrity,
              keepalive: input.keepalive,
              signal: input.signal
            }
          : {}),
        ...init,
        headers
      });
    }

    return window.fetch(input, init);
  };
}

export function isSupabaseConfigured() {
  try {
    readSupabaseConfig();
    return true;
  } catch {
    return false;
  }
}

export function getSupabaseBrowserClient(): SupabaseClient {
  const { url, key } = readSupabaseConfig();
  client ??= createBrowserClient(url, key, {
    global: {
      fetch: createAuthAwareFetch(url)
    }
  });
  return client;
}
