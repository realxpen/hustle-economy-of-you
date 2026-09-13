"use client";

import { getSupabaseBrowserClient } from "./supabase/client";

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export interface WalletBalance {
  currency: string;
  availableMinor: number;
  pendingMinor: number;
  escrowMinor: number;
  payoutReservedMinor: number;
}

export interface WalletSnapshot {
  userId: string;
  balances: WalletBalance[];
  balanceAuthority: "LEDGER";
  writableByClient: false;
}

export interface WalletTransaction {
  id: string;
  ledgerTransactionId: string;
  subjectType: "BOOKING" | "ORDER";
  subjectId: string;
  type:
    | "PAYMENT_CONFIRMED"
    | "ESCROW_HELD"
    | "ESCROW_RELEASED"
    | "REFUND"
    | "PAYOUT_RESERVED"
    | "PAYOUT_SENT"
    | "PAYOUT_REVERSED"
    | "ADJUSTMENT";
  reference: string | null;
  accountType: "PROVIDER_CLEARING" | "ESCROW" | "PENDING" | "AVAILABLE" | "PAYOUT_RESERVED";
  currency: string;
  direction: "DEBIT" | "CREDIT";
  amountMinor: number;
  signedAmountMinor: number;
  createdAt: string;
}

export interface WalletTransactionPage {
  items: WalletTransaction[];
}

async function parseError(response: Response) {
  const body = await response.json().catch(() => null) as {
    error?: { message?: string };
    message?: string;
  } | null;
  return body?.error?.message ?? body?.message ?? `Hustle API returned ${response.status}`;
}

async function authenticatedFetch(path: string, init?: RequestInit) {
  const supabase = getSupabaseBrowserClient();
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.access_token) throw new Error("You need to sign in again");

  const headers = new Headers(init?.headers);
  headers.set("authorization", `Bearer ${session.access_token}`);
  if (init?.body) headers.set("content-type", "application/json");

  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers,
    cache: "no-store"
  });
  if (!response.ok) throw new Error(await parseError(response));
  return response;
}

export async function getWallet() {
  const response = await authenticatedFetch("/wallet");
  return response.json() as Promise<WalletSnapshot>;
}

export async function listWalletTransactions(limit = 50) {
  const response = await authenticatedFetch(`/wallet/transactions?limit=${encodeURIComponent(String(limit))}`);
  return response.json() as Promise<WalletTransactionPage>;
}

export async function releaseBookingEscrow(bookingId: string) {
  const response = await authenticatedFetch(`/wallet/escrows/bookings/${encodeURIComponent(bookingId)}/release`, {
    method: "POST"
  });
  return response.json() as Promise<{
    released: true;
    duplicate: boolean;
    escrowId: string;
    ledgerTransactionId: string;
    wallet: WalletSnapshot;
  }>;
}

export async function releaseOrderSettlement(orderId: string) {
  const response = await authenticatedFetch(`/wallet/settlements/orders/${encodeURIComponent(orderId)}/release`, {
    method: "POST"
  });
  return response.json() as Promise<{
    released: true;
    duplicate: boolean;
    ledgerTransactionId: string;
    wallet: WalletSnapshot;
  }>;
}

export function formatWalletMoney(minor: number, currency = "NGN") {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: currency || "NGN",
    maximumFractionDigits: minor % 100 === 0 ? 0 : 2
  }).format(minor / 100);
}
