"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AuthenticatedApiError, authenticatedFetch } from "../../../lib/api/authenticated-fetch";
import { isolatedWebMode } from "../../../lib/auth/isolated-web-auth";
import type { BookingRecord } from "../../../lib/booking";

// Previously completed disposable UX009 booking, verified as COMPLETED with
// an already ACCEPTED time proposal. NEVER test on pending/new bookings.
const SAFE_COMPLETED_BOOKING_ID = "cmvoab8rz0003kz05f3cvn575";

type TestState =
  | { stage: "checking" }
  | { stage: "ready"; booking: BookingRecord }
  | { stage: "running"; booking: BookingRecord }
  | { stage: "complete"; booking: BookingRecord; passed: boolean; status: number | null; unchanged: boolean; message: string }
  | { stage: "unavailable"; message: string };

const shared = {
  card: { border: "1px solid var(--h-border, #929b8b)", borderRadius: 20, padding: 20, background: "var(--h-surface, #182018)" },
  muted: { opacity: 0.78, lineHeight: 1.65 } as const
};

async function loadSafeBooking() {
  const response = await authenticatedFetch(
    `/bookings/${SAFE_COMPLETED_BOOKING_ID}`,
    { method: "GET", cache: "no-store" }
  );
  if (!response.ok) throw new Error("This signed-in account cannot access the disposable QA booking.");
  const booking = await response.json() as BookingRecord;
  if (
    booking.id !== SAFE_COMPLETED_BOOKING_ID ||
    booking.status !== "COMPLETED" ||
    booking.timeProposalStatus !== "ACCEPTED" ||
    !booking.timeProposalId ||
    (booking.viewerRole !== "CLIENT" && booking.viewerRole !== "HUSTLER") ||
    booking.clientUserId === booking.hustlerUserId
  ) {
    throw new Error("QA fixture is not in its verified, terminal state. No test request was sent.");
  }
  return booking;
}

export function UX009AuthorizationCheck() {
  const [state, setState] = useState<TestState>({ stage: "checking" });

  const inspect = useCallback(async () => {
    if (!isolatedWebMode) {
      setState({ stage: "unavailable", message: "This check is only available in isolated staging." });
      return;
    }
    setState({ stage: "checking" });
    try {
      setState({ stage: "ready", booking: await loadSafeBooking() });
    } catch (reason) {
      setState({ stage: "unavailable", message: reason instanceof Error ? reason.message : "QA booking unavailable." });
    }
  }, []);

  useEffect(() => { void inspect(); }, [inspect]);

  async function run(booking: BookingRecord) {
    if (
      !isolatedWebMode || state.stage !== "ready" ||
      booking.id !== SAFE_COMPLETED_BOOKING_ID ||
      booking.status !== "COMPLETED" || !booking.timeProposalId
    ) return;

    setState({ stage: "running", booking });
    // Each tested action targets a booking which cannot legally transition:
    // Client tries Hustler-only acceptance of already COMPLETED work;
    // Hustler tries Client-only response to an already ACCEPTED proposal.
    // Neither request handles funds, release, payment or a withdrawal.
    const client = booking.viewerRole === "CLIENT";
    const route = client
      ? `/bookings/${SAFE_COMPLETED_BOOKING_ID}/accept`
      : `/bookings/${SAFE_COMPLETED_BOOKING_ID}/respond-time`;
    const body = client
      ? {}
      : { proposalId: booking.timeProposalId, decision: "DECLINE" };

    let status: number | null = null;
    let participantGuardDenied = false;
    try {
      const response = await authenticatedFetch(route, {
        method: "POST", cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      status = response.status;
    } catch (reason) {
      // authenticatedFetch intentionally throws on every non-2xx HTTP status.
      // Preserve the actual status of a server denial instead of incorrectly
      // labeling the expected HTTP 403 as "not received".
      if (reason instanceof AuthenticatedApiError) {
        status = reason.status;
        // HTTP 403 from a proxy/CSRF/staging gate is not evidence of the
        // BookingService participant permission guard. Match its exact, fixed
        // domain error message without exposing server payloads in the UI.
        participantGuardDenied = status === 403 && (client
          ? reason.message === "An ACTIVE HUSTLER capability is required for this action" ||
            reason.message === "Only the booked Hustler can accept this Booking"
          : reason.message === "Only the Client can accept or decline a proposed time");
      } else {
        setState({
          stage: "complete", booking, passed: false, status: null, unchanged: false,
          message: "INCOMPLETE: No HTTP response was captured. Do not repeat the action."
        });
        return;
      }
    }

    // Even an HTTP 403 does not qualify as PASS until a separate authenticated
    // GET proves this exact terminal booking and proposal remain unchanged.
    try {
      const after = await loadSafeBooking();
      const unchanged =
        after.status === booking.status &&
        after.updatedAt === booking.updatedAt &&
        after.timeProposalStatus === booking.timeProposalStatus &&
        after.timeProposalId === booking.timeProposalId;
      const passed = status === 403 && participantGuardDenied && unchanged;
      setState({
        stage: "complete", booking, passed, status, unchanged,
        message: passed
          ? "PASS: The live API returned HTTP 403 Forbidden; the completed booking remained unchanged."
          : "NOT VERIFIED: The HTTP result, participant permission denial, or booking invariants differed. Stop here and report this result."
      });
    } catch {
      setState({
        stage: "complete", booking, passed: false, status, unchanged: false,
        message: "INCOMPLETE: The server status was captured but booking integrity could not be independently confirmed. Do not repeat the action."
      });
    }
  }

  return (
    <main className="accountShell h-experience-shell" style={{ paddingBottom: 130 }}>
      <div style={{ maxWidth: 660, margin: "24px auto", display: "grid", gap: 20 }}>
        <p><Link href="/account">← Back to your account</Link></p>
        <header>
          <p style={{ letterSpacing: ".14em", fontSize: 12, fontWeight: 800 }}>HUSTLE · UX009 · STAGING ONLY</p>
          <h1 style={{ fontSize: "clamp(30px, 7vw, 44px)", lineHeight: 1.1 }}>Authorization safety check</h1>
          <p style={shared.muted}>This verifies that the live AWS API rejects an action belonging to the other booking participant. No payment, escrow release, withdrawal, booking creation, or work transition is requested.</p>
        </header>
        <section style={shared.card} aria-live="polite">
          {state.stage === "checking" && <p role="status">Checking your signed-in QA account and completed booking…</p>}
          {state.stage === "unavailable" && <>
            <strong>Check unavailable</strong>
            <p>{state.message}</p>
            <button type="button" onClick={() => void inspect()}>Retry safe check</button>
          </>}
          {(state.stage === "ready" || state.stage === "running" || state.stage === "complete") && <>
            <p style={{ letterSpacing: ".1em", fontSize: 12 }}>SIGNED-IN BOOKING PARTICIPANT</p>
            <h2>{state.booking.viewerRole === "CLIENT" ? "Client test account" : "Hustler test account"}</h2>
            <p style={shared.muted}>Fixture: COMPLETED booking with an already resolved proposal. The action is supposed to be rejected with HTTP 403 before any booking state check or write.</p>
            {state.stage === "ready" && (
              <button type="button" onClick={() => void run(state.booking)}
                style={{ padding: "14px 20px", minHeight: 48, borderRadius: 14, background: "#C9F26B", color: "#15210e", border: 0, fontWeight: 800 }}>
                Test {state.booking.viewerRole === "CLIENT" ? "Client → Hustler-only action" : "Hustler → Client-only action"}
              </button>
            )}
            {state.stage === "running" && <p role="status">Checking HTTP denial and unchanged booking state…</p>}
            {state.stage === "complete" && <>
              <h2 role="status" style={{ color: state.passed ? "#94cb4d" : "#dc684c" }}>{state.passed ? "PASS" : "NOT VERIFIED"}</h2>
              <p>{state.message}</p>
              <p>Server response: <strong>{state.status === null ? "not received" : `HTTP ${state.status}`}</strong></p>
              <p>Booking unchanged: <strong>{state.unchanged ? "Yes" : "Not confirmed"}</strong></p>
              <p style={shared.muted}>Sign out and sign in as the other invited QA participant to run the other half. Results are not saved to device storage or sent to analytics.</p>
            </>}
          </>}
        </section>
        <p style={shared.muted}>This diagnostic is accessible only in the isolated staging build. If an unexpected result appears, do not repeat the action; report its displayed HTTP status. CI already independently tests that the Hustler cannot release Client escrow.</p>
      </div>
    </main>
  );
}
