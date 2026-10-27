"use client";

import { getSupabaseBrowserClient, isSupabaseConfigured } from "../supabase/client";
import { isolatedWebMode, stagingSession } from "../auth/isolated-web-auth";

/** Visitors can read published content without holding a Hustle account. */
export async function hasViewerSession(): Promise<boolean> {
  if (isolatedWebMode) {
    const { session, user } = await stagingSession();
    return Boolean(session?.token && user?.id);
  }
  // Published public GET routes must remain browseable when optional login is
  // not configured. Do not suppress real session/network errors when configured.
  if (!isSupabaseConfigured()) return false;
  const { data, error } = await getSupabaseBrowserClient().auth.getSession();
  if (error) throw error;
  return Boolean(data.session?.access_token);
}

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
export async function publicReadFetch(path: string): Promise<Response> {
  if (!path.startsWith("/") || path.startsWith("//")) throw new Error("Invalid public read path");
  return fetch(isolatedWebMode ? `/api/isolated/api/v1${path}` : `${apiBase}${path}`, {
    method: "GET", cache: "no-store", credentials: "omit",
    headers: { accept: "application/json" }
  });
}

/** Local-only redirect. Never accept an external URL or privileged API destination. */
export function safeAuthReturnPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") ||
      next.includes("\\") || /[\x00-\x1f]/.test(next) ||
      /^\/(?:auth|api|internal)(?:\/|\?|$)/i.test(next)) return "/home";
  return next;
}
export function authUrl(next: string): string {
  return `/auth?next=${encodeURIComponent(safeAuthReturnPath(next))}`;
}
export function redirectGuestToAuth() {
  window.location.assign(authUrl(window.location.pathname + window.location.search));
}
