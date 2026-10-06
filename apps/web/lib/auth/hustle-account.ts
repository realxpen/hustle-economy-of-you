"use client";

import type { HustleAccount } from "@hustle/types";
import { authenticatedFetch } from "../api/authenticated-fetch";
import { getSupabaseBrowserClient } from "../supabase/client";

let cachedAccount: HustleAccount | null = null;
let cachedAt = 0;
let accountPromise: Promise<HustleAccount> | null = null;
let syncPromise: Promise<HustleAccount> | null = null;
let authListenerAttached = false;
const accountCacheMs = 30_000;

function remember(account: HustleAccount) {
  cachedAccount = account;
  cachedAt = Date.now();
  return account;
}

function ensureAccountAuthListener() {
  if (authListenerAttached) return;
  authListenerAttached = true;
  getSupabaseBrowserClient().auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
      invalidateMyAccountCache();
    }
  });
}

export async function syncHustleAccount(): Promise<HustleAccount> {
  ensureAccountAuthListener();
  syncPromise ??= (async () => {
    const response = await authenticatedFetch("/auth/sync", { method: "POST" });
    return remember(await response.json() as HustleAccount);
  })().finally(() => {
    syncPromise = null;
  });
  return syncPromise;
}

export async function getMyAccount(options: { force?: boolean } = {}): Promise<HustleAccount> {
  ensureAccountAuthListener();
  if (!options.force && cachedAccount && Date.now() - cachedAt < accountCacheMs) {
    return cachedAccount;
  }

  accountPromise ??= (async () => {
    const response = await authenticatedFetch("/auth/me");
    return remember(await response.json() as HustleAccount);
  })().finally(() => {
    accountPromise = null;
  });

  return accountPromise;
}

export async function updateMyProfile(input: { displayName: string; username: string; bio?: string; location?: string; avatarUrl?: string }): Promise<HustleAccount> {
  ensureAccountAuthListener();
  const response = await authenticatedFetch("/auth/profile", { method: "PATCH", body: JSON.stringify(input) });
  return remember(await response.json() as HustleAccount);
}

export function invalidateMyAccountCache() {
  cachedAccount = null;
  cachedAt = 0;
}
