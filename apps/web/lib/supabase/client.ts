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
  client ??= createBrowserClient(url, key);
  return client;
}
