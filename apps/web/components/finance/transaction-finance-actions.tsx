"use client";

import { useCallback, useEffect, useState } from "react";

import {
  formatWalletMoney,
  getLatestPayment,
  initializePayment,
  newIdempotencyKey,
  releaseBookingEscrow,
  releaseOrderSettlement,
  requestRefund,
  type FinancialSubjectType,
  type PaymentAttemptRecord
} from "../../lib/finance";

type Props = {
  subjectType: FinancialSubjectType;
  subjectId: string;
  canInitialize?: boolean;
  canRefund?: boolean;
  canRelease?: boolean;
  releaseKind?: "BOOKING_ESCROW" | "ORDER_SETTLEMENT";
  onFinancialChange?: () => void | Promise<void>;
};

function idempotencyKey(storageKey: string, prefix: string) {
  const existing = window.sessionStorage.getItem(storageKey);
  if (existing) return existing;
  const created = newIdempotencyKey(prefix);
  window.sessionStorage.setItem(storageKey, created);
  return created;
}

export function TransactionFinanceActions({
  subjectType,
  subjectId,
  canInitialize = false,
  canRefund = false,
  canRelease = false,
  releaseKind,
  onFinancialChange
}: Props) {
  const [payment, setPayment] = useState<PaymentAttemptRecord | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setPayment(await getLatestPayment(subjectType, subjectId));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load payment status");
    }
  }, [subjectId, subjectType]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function afterChange() {
    await refresh();
    if (onFinancialChange) await onFinancialChange();
  }

  async function startPayment() {
    if (busy) return;
    const storageKey = `hustle:payment:${subjectType}:${subjectId}`;
    const key = idempotencyKey(storageKey, `payment-${subjectType.toLowerCase()}-${subjectId}`);
    setBusy("payment");
    setError(null);
    setNotice(null);
    try {
      const attempt = await initializePayment(subjectType, subjectId, key);
      setPayment(attempt);
      window.sessionStorage.removeItem(storageKey);
      setNotice(
        attempt.checkoutUrl
          ? "Payment initialized. Continue through the provider checkout."
          : "Payment initialized. Hustle is waiting for authoritative provider confirmation."
      );
      if (attempt.checkoutUrl) window.location.assign(attempt.checkoutUrl);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not initialize payment");
    } finally {
      setBusy(null);
    }
  }

  async function refund() {
    if (busy) return;
    const storageKey = `hustle:refund:${subjectType}:${subjectId}`;
    const key = idempotencyKey(storageKey, `refund-${subjectType.toLowerCase()}-${subjectId}`);
    setBusy("refund");
    setError(null);
    setNotice(null);
    try {
      const result = await requestRefund(subjectType, subjectId, key);
      window.sessionStorage.removeItem(storageKey);
      setNotice(`Refund request is ${result.status.toLowerCase()}. Provider confirmation remains authoritative.`);
      await afterChange();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not request refund");
    } finally {
      setBusy(null);
    }
  }

  async function release() {
    if (busy || !releaseKind) return;
    setBusy("release");
    setError(null);
    setNotice(null);
    try {
      if (releaseKind === "BOOKING_ESCROW") {
        await releaseBookingEscrow(subjectId);
        setNotice("Escrow release recorded. The Hustler available balance is now ledger-backed.");
      } else {
        await releaseOrderSettlement(subjectId);
        setNotice("Completed Order settlement moved from pending to available balance.");
      }
      await afterChange();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not release funds");
    } finally {
      setBusy(null);
    }
  }

  const hasAction = canInitialize || canRefund || (canRelease && releaseKind);

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ border: "1px solid #b7b4aa", borderRadius: 16, padding: 14, background: "#f8f6f0" }}>
        <small style={{ fontWeight: 850, letterSpacing: ".12em" }}>FINANCIAL STATE</small>
        {payment ? (
          <>
            <p style={{ margin: "8px 0 2px", fontWeight: 800 }}>
              {payment.status} · {formatWalletMoney(payment.amountMinor, payment.currency)}
            </p>
            <p style={{ margin: 0, fontSize: 12, color: "#66635a" }}>
              {payment.appliedToSubject
                ? "Verified payment has been applied to this transaction."
                : payment.status === "FAILED"
                  ? payment.failureReason ?? "The payment attempt failed. You may retry with a new attempt."
                  : "Provider confirmation is still required before transaction financial state advances."}
            </p>
          </>
        ) : (
          <p style={{ margin: "8px 0 0", fontSize: 12, color: "#66635a" }}>No payment attempt has been created for this transaction yet.</p>
        )}
      </div>

      {hasAction && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {canInitialize && (!payment || payment.status === "FAILED" || payment.status === "CANCELLED") && (
          <button disabled={Boolean(busy)} onClick={() => void startPayment()} style={{ border: 0, borderRadius: 999, padding: "12px 16px", background: "#111", color: "#fff", fontWeight: 800, cursor: "pointer" }}>
            {busy === "payment" ? "Starting…" : payment?.status === "FAILED" ? "Retry payment" : "Start secure payment"}
          </button>
        )}
        {canRefund && (
          <button disabled={Boolean(busy)} onClick={() => void refund()} style={{ border: "1px solid #111", borderRadius: 999, padding: "12px 16px", background: "transparent", fontWeight: 800, cursor: "pointer" }}>
            {busy === "refund" ? "Requesting…" : "Request refund"}
          </button>
        )}
        {canRelease && releaseKind && (
          <button disabled={Boolean(busy)} onClick={() => void release()} style={{ border: 0, borderRadius: 999, padding: "12px 16px", background: "#ff5a1f", color: "#fff", fontWeight: 800, cursor: "pointer" }}>
            {busy === "release" ? "Releasing…" : releaseKind === "BOOKING_ESCROW" ? "Confirm completion & release escrow" : "Release completed settlement"}
          </button>
        )}
        <button disabled={Boolean(busy)} onClick={() => void refresh()} style={{ border: 0, background: "transparent", textDecoration: "underline", cursor: "pointer", fontWeight: 700 }}>
          Refresh financial status
        </button>
      </div>}

      {notice && <div style={{ padding: 12, borderRadius: 12, background: "#dff6cf", fontSize: 13 }}>{notice}</div>}
      {error && <div style={{ padding: 12, borderRadius: 12, background: "#ffe0d5", color: "#8c2a09", fontSize: 13 }}>{error}</div>}
      <a href="/wallet" style={{ fontSize: 12, fontWeight: 800, textDecoration: "underline", textUnderlineOffset: 3 }}>Open wallet →</a>
    </div>
  );
}
