"use client";
import { useState } from "react";
import type { BookingRecord } from "../../lib/booking";
import { formatWalletMoney, simulateSandboxBookingComplete, simulateSandboxBookingFunding,
  simulateSandboxBookingRelease, simulateSandboxBookingStart } from "../../lib/finance";

export function SandboxBookingActions({ booking, onChange }: {
  booking: BookingRecord; onChange: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const client = booking.viewerRole === "CLIENT";
  const kind = client && booking.status === "PAYMENT_PENDING" ? "fund"
    : !client && booking.status === "FUNDED" ? "start"
    : !client && booking.status === "IN_PROGRESS" ? "complete"
    : client && booking.status === "COMPLETED" ? "release" : null;
  const names = {fund:"Simulate deposit to escrow",start:"Simulate job start",
    complete:"Simulate job completion",release:"Release simulated escrow"};
  async function run() {
    if (!kind || busy || !window.confirm("TEST ONLY: This updates the disposable Hustle sandbox ledger or job state. No real money or work is involved. Proceed?")) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const result = kind === "fund" ? await simulateSandboxBookingFunding(booking.id)
        : kind === "start" ? await simulateSandboxBookingStart(booking.id)
        : kind === "complete" ? await simulateSandboxBookingComplete(booking.id)
        : await simulateSandboxBookingRelease(booking.id);
      if (!result || typeof result !== "object") throw new Error("Invalid sandbox action response");
      setNotice("Test action accepted. Refreshing authoritative booking and wallet state.");
      await onChange();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Sandbox action unavailable");
    } finally { setBusy(false); }
  }
  return <section style={{border:"1px solid #a5cb55",borderRadius:20,padding:18,marginBottom:18,
    background:"color-mix(in srgb,var(--h-surface,#172219) 85%,#c9f26b 15%)"}}>
    <strong>HUSTLE SANDBOX · SIMULATED FUNDS</strong>
    <p style={{fontSize:13,lineHeight:1.5}}>No payment provider, bank, card or crypto transfer.
      {booking.status === "PAYMENT_PENDING" ? ` Booking amount: ${formatWalletMoney(booking.agreedPriceMinor, booking.currency)}.` : ""}
      Escrow remains locked until the client releases it after simulated completion.</p>
    {kind && <button type="button" onClick={() => void run()} disabled={busy}
      style={{minHeight:48,borderRadius:14,padding:"12px 18px",background:"#C9F26B",
        border:0,color:"#15210e",fontWeight:850,cursor:"pointer"}}>
      {busy ? "Processing test action…" : names[kind]}
    </button>}
    {notice && <p role="status">{notice}</p>}
    {error && <p role="alert" style={{color:"#dc684c"}}>{error}</p>}
    <p style={{fontSize:12}}>Check <a href="/wallet" style={{textDecoration:"underline",fontWeight:800}}>Sandbox Wallet & Transactions ↗</a></p>
  </section>;
}
