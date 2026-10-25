"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ExperienceState } from "../../components/experience/experience-state";
import { ExperienceHeader } from "../../components/navigation/experience-header";
import styles from "./wallet.module.css";
import Link from "next/link";
import { isolatedWebMode } from "../../lib/auth/isolated-web-auth";
import { listClientBookings, type BookingRecord } from "../../lib/booking";

import {
  formatWalletMoney,
  getReconciliation,
  getWallet,
  listRefunds,
  listWalletTransactions,
  listWithdrawals,
  newIdempotencyKey,
  requestWithdrawal,
  simulateSandboxWithdrawal,
  simulateSandboxBookingFunding,
  type PayoutRecord,
  type ReconciliationReport,
  type RefundRecord,
  type WalletSnapshot,
  type WalletTransaction
} from "../../lib/finance";

function label(type: WalletTransaction["type"]) {
  return type
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function operationKey(currency: string, amountMinor: number) {
  const storageKey = `hustle:withdrawal:${currency}:${amountMinor}`;
  const existing = window.sessionStorage.getItem(storageKey);
  if (existing) return { storageKey, idempotencyKey: existing };
  const created = newIdempotencyKey("withdrawal");
  window.sessionStorage.setItem(storageKey, created);
  return { storageKey, idempotencyKey: created };
}

export default function WalletPage() {
  const [wallet, setWallet] = useState<WalletSnapshot | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
  const [refunds, setRefunds] = useState<RefundRecord[]>([]);
  const [reconciliation, setReconciliation] = useState<ReconciliationReport | null>(null);
  const [withdrawalAmount, setWithdrawalAmount] = useState("");
  const [pendingBookings, setPendingBookings] = useState<BookingRecord[]>([]);
  const [withdrawalCurrency, setWithdrawalCurrency] = useState("NGN");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [walletData, transactionData, payoutData, refundData, reconciliationData, bookingData] = await Promise.all([
      getWallet(),
      listWalletTransactions(50),
      listWithdrawals(50),
      listRefunds(50),
      getReconciliation(),
      isolatedWebMode ? listClientBookings({ limit: 50 }) : Promise.resolve({ items: [] as BookingRecord[] })
    ]);
    setWallet(walletData);
    setTransactions(transactionData.items);
    setPayouts(payoutData.items);
    setRefunds(refundData.items);
    setReconciliation(reconciliationData);
    setPendingBookings(bookingData.items.filter((booking) => booking.status === "PAYMENT_PENDING" && booking.agreedPriceMinor > 0));
    if (walletData.balances.length > 0 && !walletData.balances.some((item) => item.currency === withdrawalCurrency)) {
      setWithdrawalCurrency(walletData.balances[0].currency);
    }
  }, [withdrawalCurrency]);

  useEffect(() => {
    let active = true;
    load().then(() => { if (active) setError(null); })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Unable to load wallet"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [load]);

  async function retry() {
    setLoading(true); setError(null);
    try { await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to refresh wallet"); }
    finally { setLoading(false); }
  }

  const currencies = useMemo(() => wallet?.balances ?? [], [wallet]);

  async function withdraw() {
    if (busy) return;
    const major = Number(withdrawalAmount);
    if (!Number.isFinite(major) || major <= 0) {
      setError("Enter a valid withdrawal amount.");
      return;
    }
    const amountMinor = Math.round(major * 100);
    const balance = currencies.find((item) => item.currency === withdrawalCurrency);
    if (!Number.isSafeInteger(amountMinor) || !balance || amountMinor > balance.availableMinor) {
      setError("The requested amount exceeds your currently available ledger-backed balance.");
      return;
    }
    if (isolatedWebMode && !window.confirm("SIMULATION ONLY: Reserve this amount for a test withdrawal? No money will reach a bank.")) return;
    const { storageKey, idempotencyKey } = operationKey(withdrawalCurrency, amountMinor);
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const payout = isolatedWebMode
        ? await simulateSandboxWithdrawal(amountMinor, idempotencyKey)
        : await requestWithdrawal(amountMinor, withdrawalCurrency, idempotencyKey);
      window.sessionStorage.removeItem(storageKey);
      setWithdrawalAmount("");
      setNotice(isolatedWebMode
        ? `TEST-ONLY withdrawal: ${payout.status}. No real bank transfer was made.`
        : `Withdrawal request status: ${payout.status}. ${payout.providerReference ? `Provider reference: ${payout.providerReference}.` : "Confirmation depends on the payment provider."}`);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Withdrawal request failed");
    } finally {
      setBusy(false);
    }
  }

  async function fundBooking(id: string) {
    if (busy || !window.confirm("SIMULATE FUNDS ONLY: No card, bank account, crypto or real money is charged. Fund this booking's test escrow?")) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const result = await simulateSandboxBookingFunding(id);
      if (!result.simulated || result.realFundsMoved) throw new Error("Unsafe provider response");
      setNotice("Test booking funded. Only the Hustle sandbox ledger was updated.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not fund the test booking");
    } finally { setBusy(false); }
  }

  if (!wallet) return <main className="accountShell h-experience-shell">
    <ExperienceHeader section="Wallet" trail={[{ href: "/account", label: "Account" }]} />
    <ExperienceState kind={loading ? "loading" : "error"} title={loading ? "Loading your wallet…" : "Wallet unavailable."} description={loading ? "Reading your balances from the ledger." : error ?? "Could not read your financial records."} action={loading ? undefined : { label: "Retry wallet", onClick: () => void retry() }} />
  </main>;

  return (
    <main className="accountShell h-experience-shell">
      <ExperienceHeader section="Wallet" trail={[{ href: "/account", label: "Account" }]} secondaryLinks={[{ href: "/bookings", label: "Bookings" }, { href: "/orders", label: "Orders" }]} />

      {isolatedWebMode && <div className={styles.sandboxBanner} role="status"><strong>HUSTLE SANDBOX · SIMULATED ₦ ONLY</strong><span>No real deposits, withdrawals or transfers. Balances are test ledger entries in the isolated database.</span></div>}
      <section className="identityHero" style={{ gridTemplateColumns: "1fr auto" }}>
        <div className="identityText">
          <p className="kicker">{isolatedWebMode ? "SIMULATED MONEY · TEST WALLET" : "YOUR MONEY ON HUSTLE"}</p>
          <h1>Wallet.</h1>
          <p>{isolatedWebMode ? "View sandbox test balances, escrow holds, payment movements and withdrawal requests." : "Ledger-backed balances, escrow, withdrawals and authoritative financial history."}</p>
        </div>
        <div className="roundAction" aria-label="Ledger authority">₦</div>
      </section>

      {isolatedWebMode && <section className={styles.sandboxPayments} aria-label="Simulated booking deposits">
        <div><span className="kicker">SANDBOX DEPOSIT · FUND A BOOKING</span><h2>Pending test payments</h2>
        <p>Only an accepted booking can receive simulated funds. Payment goes to test escrow, not a withdrawable client balance.</p></div>
        {pendingBookings.length === 0
          ? <p>No accepted bookings are awaiting test funds. <Link href="/bookings">View bookings ↗</Link></p>
          : pendingBookings.map(booking => <div key={booking.id} className={styles.pendingBooking}>
              <div><strong>{booking.serviceTitleSnapshot}</strong><small>{formatWalletMoney(booking.agreedPriceMinor, booking.currency)} · PAYMENT_PENDING</small></div>
              <button type="button" disabled={busy} onClick={() => void fundBooking(booking.id)}>
                {busy ? "Processing…" : "Simulate deposit →"}
              </button>
              <Link href={`/bookings/${booking.id}`}>Details</Link>
            </div>)}
      </section>}
      {notice && <div className="formNotice" style={{ marginBottom: 18 }} role="status">{notice}</div>}
      <div className={styles.walletTools}><p>Balances and statuses come from Hustle’s ledger. Pending, escrow and reserved amounts are not available to withdraw.</p><button type="button" disabled={loading || busy} onClick={() => void retry()}>{loading ? "Refreshing…" : "Refresh wallet"}</button></div>
      {error && <div className="formNotice errorNotice" role="alert" style={{ marginBottom: 18 }}>{error}</div>}

      <section className="accountGrid" style={{ marginBottom: 28 }}>
        {currencies.length === 0 ? (
          <article className="capabilityCard">
            <small>NO BALANCE YET</small>
            <h2 style={{ margin: "auto 0 10px", fontSize: 34, letterSpacing: "-.04em" }}>Your first settled transaction will appear here.</h2>
            <p>Pending, escrow and available balances are created from authoritative financial events.</p>
          </article>
        ) : currencies.map((balance) => (
          <article className="capabilityCard" key={balance.currency}>
            <small>{balance.currency} BALANCE</small>
            <p className={styles.balanceHint}>Only Available funds may be requested for withdrawal. Pending and escrow funds must complete their authoritative lifecycle first.</p>
            <div className="capabilityList" style={{ marginTop: 20 }}>
              <div><strong>{formatWalletMoney(balance.availableMinor, balance.currency)}</strong><span className="active">AVAILABLE</span></div>
              <div><strong>{formatWalletMoney(balance.pendingMinor, balance.currency)}</strong><span>PENDING</span></div>
              <div><strong>{formatWalletMoney(balance.escrowMinor, balance.currency)}</strong><span>ESCROW</span></div>
              <div><strong>{formatWalletMoney(balance.payoutReservedMinor, balance.currency)}</strong><span>WITHDRAWAL RESERVED</span></div>
            </div>
          </article>
        ))}

        <article className="trustCard">
          <small>BALANCE AUTHORITY</small>
          <div className="trustMetric"><strong>{wallet.balanceAuthority}</strong><span>Source of truth</span></div>
          <div className="trustMetric"><strong>{wallet.writableByClient ? "Yes" : "No"}</strong><span>Client editable</span></div>
          <div className="trustMetric"><strong>{reconciliation ? (reconciliation.healthy ? "Healthy" : "Review required") : "Unavailable"}</strong><span>{reconciliation ? `${reconciliation.issueCount} reconciliation issues` : "No status loaded"}</span></div>
        </article>

        <article className="nextCard">
          <small>WITHDRAW</small>
          <h2>{isolatedWebMode ? "Simulate a withdrawal reservation." : "Move available balance out."}</h2>
          <p>{isolatedWebMode ? "Reserves test-only available funds. Nothing is transferred to a bank; provider confirmation remains simulated." : "Hustle reserves funds first. Only a signed provider event can mark the payout successful."}</p>
          <label style={{ display: "grid", gap: 8, marginTop: 18 }}>
            <span style={{ fontSize: 12, fontWeight: 800 }}>AMOUNT</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={withdrawalAmount}
              onChange={(event) => setWithdrawalAmount(event.target.value)}
              placeholder="0.00"
              style={{ border: "1px solid #b8b5ac", background: "#f8f6f0", borderRadius: 16, padding: 16, minHeight: 48 }}
            />
          </label>
          <label style={{ display: "grid", gap: 8, marginTop: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 800 }}>CURRENCY</span>
            <select
              value={withdrawalCurrency}
              onChange={(event) => setWithdrawalCurrency(event.target.value)}
              style={{ border: "1px solid #b8b5ac", background: "#f8f6f0", borderRadius: 16, padding: 16 }}
            >
              {(currencies.length ? currencies : [{ currency: "NGN" }]).map((item) => <option key={item.currency} value={item.currency}>{item.currency}</option>)}
            </select>
          </label>
          <button className="primaryAction" disabled={busy || loading || currencies.length === 0} onClick={() => void withdraw()} style={{ marginTop: 18 }}>
            <span>{busy ? "Reserving…" : isolatedWebMode ? "Simulate withdrawal" : "Request withdrawal"}</span><b>↗</b>
          </button>
        </article>
      </section>

      <section style={{ borderTop: "1px solid #b7b4aa", paddingTop: 24 }}>
        <div className={styles.historyHeading}><div><p className="kicker">TRANSACTION HISTORY</p><h2>Every ledger movement, in order.</h2></div><span>{transactions.length} recent entries</span></div>
        {transactions.length === 0 ? (
          <div className="simpleCard" style={{ width: "100%" }}><h2>No financial activity yet.</h2><p>Confirmed payments, escrow movement, refunds and payouts will appear here.</p></div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {transactions.map((transaction) => (
              <article key={transaction.id} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 18, alignItems: "center", border: "1px solid #b7b4aa", borderRadius: 22, padding: 20 }}>
                <div>
                  <small style={{ letterSpacing: ".13em", fontWeight: 800, color: "#77736b" }}>{transaction.accountType}</small>
                  <h3 style={{ margin: "8px 0 4px", fontSize: 24 }}>{label(transaction.type)}</h3>
                  <p style={{ margin: 0, color: "#656259", fontSize: 13 }}>{transaction.subjectType} · {transaction.subjectId} · {new Date(transaction.createdAt).toLocaleString()}</p>
                </div>
                <strong className={styles.transactionAmount} style={{ color: transaction.signedAmountMinor >= 0 ? "inherit" : "#8c2a09" }}>
                  {transaction.signedAmountMinor >= 0 ? "+" : "−"}{formatWalletMoney(Math.abs(transaction.signedAmountMinor), transaction.currency)}
                </strong>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="accountGrid" style={{ marginTop: 28 }}>
        <article className="capabilityCard">
          <small>WITHDRAWALS</small>
          <div style={{ display: "grid", gap: 10, marginTop: 22 }}>
            {payouts.length === 0 ? <p>No withdrawal requests yet.</p> : payouts.slice(0, 6).map((payout) => (
              <div key={payout.id} style={{ borderTop: "1px solid #c7c3b9", paddingTop: 10 }}>
                <strong>{formatWalletMoney(payout.amountMinor, payout.currency)}</strong>
                <p>{payout.status} · {new Date(payout.requestedAt).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="capabilityCard">
          <small>REFUNDS</small>
          <div style={{ display: "grid", gap: 10, marginTop: 22 }}>
            {refunds.length === 0 ? <p>No refund operations yet.</p> : refunds.slice(0, 6).map((refund) => (
              <div key={refund.id} style={{ borderTop: "1px solid #c7c3b9", paddingTop: 10 }}>
                <strong>{formatWalletMoney(refund.amountMinor, refund.currency)}</strong>
                <p>{refund.subjectType} · {refund.status}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="capabilityCard">
          <small>RECONCILIATION</small>
          <h2 style={{ margin: "auto 0 10px", fontSize: 38, letterSpacing: "-.04em" }}>{reconciliation ? (reconciliation.healthy ? "Healthy" : `${reconciliation.issueCount} issue(s)`) : "Unavailable"}</h2>
          <p>{reconciliation ? (reconciliation.healthy ? "Current ledger and financial workflow invariants are internally consistent." : "There are financial records that need retry, provider confirmation or investigation.") : "Reconciliation data could not be loaded. Refresh to check again."}</p>
        </article>
      </section>

      <footer className="previewFooter">
        <span>Wallet balances are projections of immutable ledger postings.</span>
        <span>{isolatedWebMode ? "TEST FUNDS ONLY · No real deposits, card charges, bank transfers or cash-out." : "Sandbox payout/refund success requires signed provider confirmation."}</span>
      </footer>
    </main>
  );
}
