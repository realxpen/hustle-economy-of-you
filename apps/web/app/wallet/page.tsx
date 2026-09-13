"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  formatWalletMoney,
  getReconciliation,
  getWallet,
  listRefunds,
  listWalletTransactions,
  listWithdrawals,
  newIdempotencyKey,
  requestWithdrawal,
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
  const [withdrawalCurrency, setWithdrawalCurrency] = useState("NGN");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [walletData, transactionData, payoutData, refundData, reconciliationData] = await Promise.all([
      getWallet(),
      listWalletTransactions(50),
      listWithdrawals(50),
      listRefunds(50),
      getReconciliation()
    ]);
    setWallet(walletData);
    setTransactions(transactionData.items);
    setPayouts(payoutData.items);
    setRefunds(refundData.items);
    setReconciliation(reconciliationData);
    if (walletData.balances.length > 0 && !walletData.balances.some((item) => item.currency === withdrawalCurrency)) {
      setWithdrawalCurrency(walletData.balances[0].currency);
    }
  }, [withdrawalCurrency]);

  useEffect(() => {
    load().catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load wallet"));
  }, [load]);

  const currencies = useMemo(() => wallet?.balances ?? [], [wallet]);

  async function withdraw() {
    if (busy) return;
    const major = Number(withdrawalAmount);
    if (!Number.isFinite(major) || major <= 0) {
      setError("Enter a valid withdrawal amount.");
      return;
    }
    const amountMinor = Math.round(major * 100);
    const { storageKey, idempotencyKey } = operationKey(withdrawalCurrency, amountMinor);
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const payout = await requestWithdrawal(amountMinor, withdrawalCurrency, idempotencyKey);
      window.sessionStorage.removeItem(storageKey);
      setWithdrawalAmount("");
      setNotice(`Withdrawal ${payout.status.toLowerCase()} with sandbox provider reference ${payout.providerReference ?? payout.id}.`);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Withdrawal request failed");
    } finally {
      setBusy(false);
    }
  }

  if (!wallet) {
    return (
      <main className="accountShell">
        <header className="topLine">
          <a className="brandMark" href="/">HUSTLE<span>↗</span></a>
          <a className="textButton" href="/account">Account</a>
        </header>
        <p>{error ?? "Loading your ledger-backed wallet…"}</p>
      </main>
    );
  }

  return (
    <main className="accountShell">
      <header className="topLine">
        <a className="brandMark" href="/">HUSTLE<span>↗</span></a>
        <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
          <a className="textButton" href="/orders">Orders</a>
          <a className="textButton" href="/bookings">Bookings</a>
          <a className="textButton" href="/account">Account</a>
        </div>
      </header>

      <section className="identityHero" style={{ gridTemplateColumns: "1fr auto" }}>
        <div className="identityText">
          <p className="kicker">YOUR MONEY ON HUSTLE</p>
          <h1>Wallet.</h1>
          <p>Ledger-backed balances, escrow, withdrawals and authoritative financial history.</p>
        </div>
        <div className="roundAction" aria-label="Ledger authority">₦</div>
      </section>

      {notice && <div className="formNotice" style={{ marginBottom: 18 }}>{notice}</div>}
      {error && <div className="formNotice errorNotice" style={{ marginBottom: 18 }}>{error}</div>}

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
            <div className="capabilityList" style={{ marginTop: 30 }}>
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
          <div className="trustMetric"><strong>{reconciliation?.healthy ? "Healthy" : "Review"}</strong><span>{reconciliation?.issueCount ?? 0} reconciliation issues</span></div>
        </article>

        <article className="nextCard">
          <small>WITHDRAW</small>
          <h2>Move available balance out.</h2>
          <p>Hustle reserves funds first. Only a signed provider event can mark the payout successful.</p>
          <label style={{ display: "grid", gap: 8, marginTop: 18 }}>
            <span style={{ fontSize: 12, fontWeight: 800 }}>AMOUNT</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={withdrawalAmount}
              onChange={(event) => setWithdrawalAmount(event.target.value)}
              placeholder="0.00"
              style={{ border: "1px solid #b8b5ac", background: "#f8f6f0", borderRadius: 16, padding: 16 }}
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
          <button className="primaryAction" disabled={busy} onClick={() => void withdraw()} style={{ marginTop: 18 }}>
            <span>{busy ? "Reserving…" : "Request withdrawal"}</span><b>↗</b>
          </button>
        </article>
      </section>

      <section style={{ borderTop: "1px solid #b7b4aa", paddingTop: 24 }}>
        <p className="kicker">TRANSACTION HISTORY</p>
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
                <strong style={{ fontSize: 24, color: transaction.signedAmountMinor >= 0 ? "inherit" : "#8c2a09" }}>
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
          <h2 style={{ margin: "auto 0 10px", fontSize: 38, letterSpacing: "-.04em" }}>{reconciliation?.healthy ? "Healthy" : `${reconciliation?.issueCount ?? 0} issue(s)`}</h2>
          <p>{reconciliation?.healthy ? "Current ledger and financial workflow invariants are internally consistent." : "There are financial records that need retry, provider confirmation or investigation."}</p>
        </article>
      </section>

      <footer className="previewFooter">
        <span>Wallet balances are projections of immutable ledger postings.</span>
        <span>Sandbox payout/refund success requires signed provider confirmation.</span>
      </footer>
    </main>
  );
}
