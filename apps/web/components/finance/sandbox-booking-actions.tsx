"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { BookingRecord } from "../../lib/booking";
import { formatWalletMoney, getReleaseState, simulateSandboxBookingComplete, simulateSandboxBookingFunding,
  simulateSandboxBookingRelease, simulateSandboxBookingStart, type ReleaseStateRecord } from "../../lib/finance";

type ReleaseCheck = {
  bookingId: string;
  phase: "checking" | "ready" | "error";
  value: ReleaseStateRecord | null;
};

export function SandboxBookingActions({ booking, onChange }: {
  booking: BookingRecord; onChange: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [releaseCheck, setReleaseCheck] = useState<ReleaseCheck | null>(null);
  const releaseRequest = useRef(0);
  const client = booking.viewerRole === "CLIENT";

  // Booking COMPLETED means the job is finished, not that escrow was released.
  // Ask the participant-authorized ledger read endpoint before offering a write.
  const readReleaseState = useCallback(async (bookingId: string) => {
    const version = ++releaseRequest.current;
    setReleaseCheck({ bookingId, phase: "checking", value: null });
    try {
      const value = await getReleaseState("BOOKING", bookingId);
      if (value.subjectType !== "BOOKING" || value.subjectId !== bookingId ||
          value.releaseKind !== "BOOKING_ESCROW" || value.authoritative !== true) {
        throw new Error("Unexpected escrow state response");
      }
      if (version === releaseRequest.current)
        setReleaseCheck({ bookingId, phase: "ready", value });
    } catch {
      if (version === releaseRequest.current)
        setReleaseCheck({ bookingId, phase: "error", value: null });
    }
  }, []);

  useEffect(() => {
    if (!client || booking.status !== "COMPLETED") {
      setReleaseCheck(null);
      return;
    }
    void readReleaseState(booking.id);
    return () => { releaseRequest.current += 1; };
  }, [booking.id, booking.status, client, readReleaseState]);

  const currentRelease = releaseCheck?.bookingId === booking.id ? releaseCheck : null;
  const canRelease = currentRelease?.phase === "ready" &&
    currentRelease.value?.status === "HELD" && currentRelease.value.released === false;

  const kind = client && booking.status === "PAYMENT_PENDING" ? "fund"
    : !client && booking.status === "FUNDED" ? "start"
    : !client && booking.status === "IN_PROGRESS" ? "complete"
    : client && booking.status === "COMPLETED" && canRelease ? "release" : null;
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
      if (kind === "release") {
        if ((result as { released?: boolean }).released !== true)
          throw new Error("Escrow release was not confirmed by the server");
        // The release endpoint returns a confirmed ledger write. Preserve this
        // status immediately, even though the booking remains COMPLETED.
        setReleaseCheck({
          bookingId: booking.id, phase: "ready",
          value: {
            subjectType: "BOOKING", subjectId: booking.id, releaseKind: "BOOKING_ESCROW",
            released: true, status: "RELEASED", releasedAt: null,
            releaseRecordId: null, authoritative: true
          }
        });
        setNotice("Simulated escrow released. The Hustler can check the available balance in Wallet.");
      } else {
        setNotice("Test action accepted. Refreshing authoritative booking and wallet state.");
      }
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
    {client && booking.status === "COMPLETED" && (
      <div role="status" aria-live="polite" style={{fontSize:14,marginTop:12,marginBottom:12}}>
        {!currentRelease || currentRelease.phase === "checking"
          ? "Checking authoritative escrow status…"
          : currentRelease.phase === "error"
            ? <span>Escrow status could not be verified. To avoid a duplicate action, check status again.{" "}
                <button type="button" disabled={busy} onClick={() => void readReleaseState(booking.id)}>
                  Retry escrow status
                </button>
              </span>
            : currentRelease.value?.released
              ? <strong>✓ Simulated escrow already released. View the Hustler's available balance in Wallet.</strong>
              : currentRelease.value?.status === "HELD"
                ? "Escrow is held and ready for your release confirmation."
                : `Escrow status: ${currentRelease.value?.status ?? "UNKNOWN"}. Release is unavailable.`}
      </div>
    )}
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
