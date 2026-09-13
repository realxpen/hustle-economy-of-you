"use client";

import { useEffect, useMemo, useState } from "react";

import {
  formatWalletMoney,
  getWallet,
  listWalletTransactions,
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

export default function WalletPage() {
  const [wallet, setWallet] = useState<WalletSnapshot | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getWallet(), listWalletTransactions(50)])
      .then(([walletData, transactionData]) => {
        setWallet(walletData);
        setTransactions(transactionData.items);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load wallet"));
  }, []);

  const currencies = useMemo(() => wallet?.balances ?? [], [wallet]);

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
        <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
          <a className="textButton" href="/orders">Orders</a>
          <a className="textButton" href="/bookings">Bookings</a>
          <a className="textButton" href="/account">Account</a>
        </div>
      </header>

      <section className="identityHero" style={{ gridTemplateColumns: "1fr auto" }}>
        <div className="identityText">
          <p className="kicker">YOUR MONEY ON HUSTLE</p>
          <h1>Wallet.</h1>
          <p>Ledger-backed balances only. No client-side balance editing.</p>
        </div>
        <div className="roundAction" aria-label="Ledger authority">₦</div>
      </section>

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
        </article>
      </section>

      <section style={{ borderTop: "1px solid #b7b4aa", paddingTop: 24 }}>
        <p className="kicker">TRANSACTION HISTORY</p>
        {transactions.length === 0 ? (
          <div className="simpleCard" style={{ width: "100%" }}>
            <h2>No financial activity yet.</h2>
            <p>Confirmed payments, escrow movement, refunds and payouts will appear here.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {transactions.map((transaction) => (
              <article
                key={transaction.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0,1fr) auto",
                  gap: 18,
                  alignItems: "center",
                  border: "1px solid #b7b4aa",
                  borderRadius: 22,
                  padding: 20
                }}
              >
                <div>
                  <small style={{ letterSpacing: ".13em", fontWeight: 800, color: "#77736b" }}>{transaction.accountType}</small>
                  <h3 style={{ margin: "8px 0 4px", fontSize: 24 }}>{label(transaction.type)}</h3>
                  <p style={{ margin: 0, color: "#656259", fontSize: 13 }}>
                    {transaction.subjectType} · {transaction.subjectId} · {new Date(transaction.createdAt).toLocaleString()}
                  </p>
                </div>
                <strong style={{ fontSize: 24, color: transaction.signedAmountMinor >= 0 ? "inherit" : "#8c2a09" }}>
                  {transaction.signedAmountMinor >= 0 ? "+" : "−"}
                  {formatWalletMoney(Math.abs(transaction.signedAmountMinor), transaction.currency)}
                </strong>
              </article>
            ))}
          </div>
        )}
      </section>

      <footer className="previewFooter">
        <span>Wallet balances are projections of immutable ledger postings.</span>
        <span>Withdrawals unlock in Phase 13D.</span>
      </footer>
    </main>
  );
}
