"use client";

import { getSupabaseBrowserClient } from "./supabase/client";

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export type FinancialSubjectType = "BOOKING" | "ORDER";

export interface PaymentAttemptRecord {
  id: string;
  subjectType: FinancialSubjectType;
  subjectId: string;
  payerUserId: string;
  beneficiaryUserId: string;
  provider: string;
  providerReference: string;
  status: "INITIATED" | "PENDING" | "SUCCEEDED" | "FAILED" | "CANCELLED";
  amountMinor: number;
  currency: string;
  checkoutUrl: string | null;
  confirmedAt: string | null;
  domainAppliedAt: string | null;
  failedAt: string | null;
  failureCode: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
  authoritative: boolean;
  appliedToSubject: boolean;
}

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

export interface PayoutRecord {
  id: string;
  userId: string;
  currency: string;
  amountMinor: number;
  status: "REQUESTED" | "PROCESSING" | "SUCCEEDED" | "FAILED" | "CANCELLED";
  provider: string;
  providerReference: string | null;
  requestedAt: string;
  confirmedAt: string | null;
  failedAt: string | null;
  failureReason: string | null;
}

export interface RefundRecord {
  id: string;
  subjectType: FinancialSubjectType;
  subjectId: string;
  paymentAttemptId: string;
  requestedByUserId: string | null;
  currency: string;
  amountMinor: number;
  status: "REQUESTED" | "PROCESSING" | "SUCCEEDED" | "FAILED" | "CANCELLED";
  providerReference: string | null;
  requestedAt: string;
  confirmedAt: string | null;
  failedAt: string | null;
  failureReason: string | null;
}

export interface ReconciliationReport {
  userId: string;
  healthy: boolean;
  issueCount: number;
  issues: Array<Record<string, unknown>>;
  checkedAt: string;
  scope: string;
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

export function newIdempotencyKey(prefix: string) {
  const suffix = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${suffix}`;
}

export async function initializePayment(
  subjectType: FinancialSubjectType,
  subjectId: string,
  idempotencyKey: string
) {
  const response = await authenticatedFetch("/payments/initialize", {
    method: "POST",
    headers: { "idempotency-key": idempotencyKey },
    body: JSON.stringify({ subjectType, subjectId })
  });
  return response.json() as Promise<PaymentAttemptRecord>;
}

export async function getPaymentAttempt(paymentAttemptId: string) {
  const response = await authenticatedFetch(`/payments/${encodeURIComponent(paymentAttemptId)}`);
  return response.json() as Promise<PaymentAttemptRecord>;
}

export async function getLatestPayment(subjectType: FinancialSubjectType, subjectId: string) {
  const response = await authenticatedFetch(
    `/payments/subjects/${encodeURIComponent(subjectType)}/${encodeURIComponent(subjectId)}/latest`
  );
  return response.json() as Promise<PaymentAttemptRecord | null>;
}

export async function getWallet() {
  const response = await authenticatedFetch("/wallet");
  return response.json() as Promise<WalletSnapshot>;
}

export async function listWalletTransactions(limit = 50) {
  const response = await authenticatedFetch(`/wallet/transactions?limit=${encodeURIComponent(String(limit))}`);
  return response.json() as Promise<WalletTransactionPage>;
}

export async function listWithdrawals(limit = 50) {
  const response = await authenticatedFetch(`/wallet/withdrawals?limit=${encodeURIComponent(String(limit))}`);
  return response.json() as Promise<{ items: PayoutRecord[] }>;
}

export async function requestWithdrawal(amountMinor: number, currency: string, idempotencyKey: string) {
  const response = await authenticatedFetch("/wallet/withdrawals", {
    method: "POST",
    headers: { "idempotency-key": idempotencyKey },
    body: JSON.stringify({ amountMinor, currency })
  });
  return response.json() as Promise<PayoutRecord>;
}

export async function listRefunds(limit = 50) {
  const response = await authenticatedFetch(`/wallet/refunds?limit=${encodeURIComponent(String(limit))}`);
  return response.json() as Promise<{ items: RefundRecord[] }>;
}

export async function requestRefund(
  subjectType: FinancialSubjectType,
  subjectId: string,
  idempotencyKey: string
) {
  const response = await authenticatedFetch("/wallet/refunds", {
    method: "POST",
    headers: { "idempotency-key": idempotencyKey },
    body: JSON.stringify({ subjectType, subjectId })
  });
  return response.json() as Promise<RefundRecord>;
}

export async function getReconciliation() {
  const response = await authenticatedFetch("/wallet/reconciliation");
  return response.json() as Promise<ReconciliationReport>;
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
