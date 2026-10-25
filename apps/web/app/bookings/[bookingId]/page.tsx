"use client";

import { ExperienceStatus } from "../../../components/navigation/experience-status";
import { ExperienceHeader } from "../../../components/navigation/experience-header";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ExperienceState } from "../../../components/experience/experience-state";
import { TransactionJourney } from "../../../components/commerce/transaction-journey";
import { withTransactionReturnTo } from "../../../lib/transaction-return";
import { useParams } from "next/navigation";
import { TransactionFinanceActions } from "../../../components/finance/transaction-finance-actions";
import { SandboxBookingActions } from "../../../components/finance/sandbox-booking-actions";
import { BookingDecisionPanel, type BookingDecision } from "../../../components/booking/booking-decision-panel";
import { CounterpartyFeedbackCard } from "../../../components/trust/counterparty-feedback-card";
import { ReviewEligibilityCard } from "../../../components/trust/review-eligibility-card";
import { TransactionSafetyActions } from "../../../components/trust/transaction-safety-actions";
import {
  type BookingRecord,
  acceptBooking,
  proposeBookingTime,
  respondToBookingTime,
  cancelBooking,
  completeBooking,
  declineBooking,
  extendBooking,
  formatBookingPrice,
  getBooking,
  startBooking
} from "../../../lib/booking";
import styles from "../bookings.module.css";
import { isolatedWebMode } from "../../../lib/auth/isolated-web-auth";

function formatDate(value: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-NG", { dateStyle: "full", timeStyle: "short" }).format(new Date(value));
}

function toLocalInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function toIso(value: string) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div className={styles.fact}><small>{label}</small><strong>{value}</strong></div>;
}

export default function BookingDetailPage() {
  const params = useParams<{ bookingId: string }>();
  const [storedBooking, setBooking] = useState<BookingRecord | null>(null);
  const [reviewRefreshKey, setReviewRefreshKey] = useState(0);
  const [extensionMinutes, setExtensionMinutes] = useState(15);
  const [extensionNote, setExtensionNote] = useState("");
  const [extensionOpen, setExtensionOpen] = useState(false);
  const requestVersion = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmedStartAt, setConfirmedStartAt] = useState("");
  const [confirmedEndAt, setConfirmedEndAt] = useState("");
  const [decision, setDecision] = useState<BookingDecision | null>(null);
  const [decisionReason, setDecisionReason] = useState("");

  const applyBooking = useCallback((next: BookingRecord) => {
    setBooking(next);
    if (next.status === "REQUESTED") {
      setConfirmedStartAt(toLocalInput(next.confirmedStartAt ?? next.requestedStartAt));
      setConfirmedEndAt(toLocalInput(next.confirmedEndAt ?? next.requestedEndAt));
    }
  }, []);

  const load = useCallback(async () => {
    const id = params?.bookingId;
    if (!id) return;
    const version = ++requestVersion.current;
    try {
      setError(null);
      const next = await getBooking(id);
      if (version === requestVersion.current) applyBooking(next);
    } catch (reason) {
      if (version === requestVersion.current) setError(reason instanceof Error ? reason.message : "Could not load booking");
    }
  }, [applyBooking, params?.bookingId]);

  useEffect(() => {
    setBooking(null);
    setDecision(null);
    setDecisionReason("");
    setExtensionOpen(false);
    void load();
    return () => { requestVersion.current += 1; };
  }, [load]);

  async function act(action: () => Promise<BookingRecord>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await action();
      applyBooking(updated);
      setDecision(null);
      setDecisionReason("");
      setExtensionOpen(false);
      setExtensionNote("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Booking action failed");
    } finally {
      setBusy(false);
    }
  }

  function openDecision(next: BookingDecision) {
    if (busy) return;
    setDecision(next);
    setDecisionReason("");
    setError(null);
  }

  function submitDecision() {
    if (!booking || !decision || busy) return;
    if (decision === "DECLINE" && (booking.viewerRole !== "HUSTLER" || booking.status !== "REQUESTED")) return;
    if (decision === "CANCEL" && !(booking.viewerRole === "CLIENT"
      ? ["REQUESTED", "ACCEPTED", "PAYMENT_PENDING"].includes(booking.status)
      : ["ACCEPTED", "PAYMENT_PENDING"].includes(booking.status))) return;
    const reason = decisionReason.trim() || undefined;
    void act(() => decision === "DECLINE"
      ? declineBooking(booking.id, reason)
      : cancelBooking(booking.id, reason));
  }

  function submitExtension() {
    if (!booking || booking.viewerRole !== "HUSTLER" || booking.status !== "IN_PROGRESS" || !booking.confirmedEndAt || busy) return;
    void act(() => extendBooking(booking.id, extensionMinutes, extensionNote.trim() || undefined));
  }

  async function acceptWithSchedule() {
    if (!booking) return;
    const start = toIso(confirmedStartAt);
    const end = toIso(confirmedEndAt);
    if (!start) return setError("Choose a valid confirmed start date and time.");
    if (new Date(start).getTime() <= Date.now()) return setError("Confirmed start must be in the future.");
    if (confirmedEndAt && !end) return setError("Choose a valid confirmed end date and time.");
    if (end && new Date(end).getTime() <= new Date(start).getTime()) return setError("Confirmed end must be after confirmed start.");
    if (isolatedWebMode && (start !== booking.requestedStartAt || (end ?? null) !== booking.requestedEndAt)) {
      return setError("Send a new time proposal in Messages first. The client must submit an updated request.");
    }
    await act(() => acceptBooking(booking.id, { confirmedStartAt: start, ...(end ? { confirmedEndAt: end } : {}) }));
  }

  async function proposeAlternateTime() {
    const booking = storedBooking?.id === params?.bookingId ? storedBooking : null;
    if (!isolatedWebMode || !booking || booking.viewerRole !== "HUSTLER" || booking.status !== "REQUESTED" || busy) return;
    const start = toIso(confirmedStartAt);
    const end = toIso(confirmedEndAt);
    if (!start || new Date(start).getTime() <= Date.now())
      return setError("Select a new future start time.");
    if (confirmedEndAt && !end) return setError("Choose a valid end time.");
    if (end && new Date(end).getTime() <= new Date(start).getTime())
      return setError("The proposed end must follow the proposed start.");
    if (start === booking.requestedStartAt && (end ?? null) === booking.requestedEndAt)
      return setError("Choose a different time to propose.");
    await act(() => proposeBookingTime(booking.id, {
      startAt: start,
      ...(end ? { endAt: end } : {})
    }));
  }

  const booking = storedBooking?.id === params?.bookingId ? storedBooking : null;
  if (error && !booking) return <main className={styles.shell}><ExperienceState kind="error" title="Booking unavailable." description={error} action={{label:"Retry booking",onClick:()=>void load()}} /></main>;
  if (!booking) return <main className={styles.shell}><ExperienceState kind="loading" title="Loading booking…" /></main>;

  const other = booking.viewerRole === "CLIENT" ? booking.hustler : booking.client;
  const otherLabel = other.displayName ?? other.username ?? "participant";
  const canCancel = booking.viewerRole === "CLIENT" ? ["REQUESTED", "ACCEPTED", "PAYMENT_PENDING"].includes(booking.status) : ["ACCEPTED", "PAYMENT_PENDING"].includes(booking.status);
  const canReviewBooking = booking.viewerRole === "CLIENT" && booking.status === "COMPLETED";
  const pendingTimeProposal = booking.status === "REQUESTED" &&
    booking.timeProposalStatus === "PENDING" && Boolean(booking.timeProposalId);
  const canAccept = booking.viewerRole === "HUSTLER" && booking.status === "REQUESTED" &&
    !pendingTimeProposal;
  // Match the backend gate: unpaid free bookings may start after acceptance;
  // paid bookings require server-confirmed funding, never merely an ACCEPTED label.
  const canStart = !isolatedWebMode && booking.viewerRole === "HUSTLER" && (
    (booking.status === "ACCEPTED" && !booking.paymentBoundary.required) ||
    (booking.status === "FUNDED" && booking.paymentBoundary.funded)
  );
  const canComplete = !isolatedWebMode && booking.viewerRole === "HUSTLER" && booking.status === "IN_PROGRESS";
  const messageUrl = withTransactionReturnTo(
    booking.conversationId ? `/messages/${encodeURIComponent(booking.conversationId)}`
      : `/messages/start?userId=${encodeURIComponent(other.id)}&contextType=SERVICE&contextId=${encodeURIComponent(booking.serviceId)}`,
    `/bookings/${encodeURIComponent(booking.id)}`
  );

  return <main className={[styles.shell, "h-experience-shell"].join(" ")}>
    <ExperienceHeader section="Booking detail" trail={[{ href: "/bookings", label: "Bookings" }]}
      secondaryLinks={[{ href: `/services/${booking.serviceId}`, label: "Service" }, { href: "/messages", label: "Messages" }, { href: "/wallet", label: isolatedWebMode ? "Sandbox Wallet" : "Wallet" }]} />

    {booking.status === "REQUESTED" && booking.timeProposalId && booking.timeProposalStartAt && (
      <section className={styles.timeProposalPanel} aria-label="Alternate booking time proposal">
        <p className={styles.eyebrow}>BOOKING TIME PROPOSAL</p>
        <h2>{pendingTimeProposal
          ? booking.viewerRole === "CLIENT" ? "The Hustler proposed another time" : "Waiting for the Client"
          : booking.timeProposalStatus === "ACCEPTED" ? "Alternate time accepted" : "Alternate time declined"}</h2>
        <div className={styles.facts}>
          <Fact label="CURRENT REQUEST" value={formatDate(booking.requestedStartAt)} />
          <Fact label="PROPOSED START" value={formatDate(booking.timeProposalStartAt)} />
          <Fact label="PROPOSED END" value={formatDate(booking.timeProposalEndAt)} />
        </div>
        {booking.timeProposalNote && <p className={styles.copy}>{booking.timeProposalNote}</p>}
        {pendingTimeProposal && booking.viewerRole === "CLIENT" ? <>
          <p>Accept to revise your requested time, or decline to keep the original request.
            The Hustler must still confirm the booking. No payment is made.</p>
          <div className={styles.proposalActions}>
            <button type="button" className={styles.primary} disabled={busy}
              onClick={() => void act(() => respondToBookingTime(booking.id, {
                proposalId: booking.timeProposalId!, decision: "ACCEPT"
              }))}>{busy ? "Processing…" : "Accept proposed time"}</button>
            <button type="button" className={styles.secondary} disabled={busy}
              onClick={() => void act(() => respondToBookingTime(booking.id, {
                proposalId: booking.timeProposalId!, decision: "DECLINE"
              }))}>Decline proposed time</button>
          </div>
        </> : pendingTimeProposal ? <p>The Client can accept or decline the new time from this booking.
          You cannot confirm the schedule while the proposal is pending.</p>
          : <p>{booking.timeProposalStatus === "ACCEPTED"
            ? "The Client agreed to the new time. The Hustler must still confirm the booking; no payment is authorized."
            : "The original request remains pending. The Hustler may accept it or suggest another time."}</p>}
        <button type="button" className={styles.secondary} disabled={busy}
          onClick={() => void load()}>Refresh proposal status</button>
        {error && <p className={styles.error} role="alert">{error}</p>}
      </section>
    )}

    {isolatedWebMode ? <SandboxBookingActions booking={booking} onChange={async () => { await load(); setReviewRefreshKey((version) => version + 1); }} /> : <TransactionJourney kind="BOOKING" status={booking.status} paymentRequired={booking.paymentBoundary.required} funded={booking.paymentBoundary.funded} />}
    {isolatedWebMode && canReviewBooking && (
      <section id="booking-review" aria-label="Review your completed booking" style={{ scrollMarginTop: 24, marginTop: 18 }}>
        <ReviewEligibilityCard key={`${booking.id}:${reviewRefreshKey}`} subjectType="BOOKING" subjectId={booking.id} />
      </section>
    )}
    <section className={styles.handoff} aria-label="Booking next steps">
      <div><strong>Next step</strong><p>{booking.nextAction ?? "Check your booking status or discuss the details in Messages."}</p></div>
      <div className={styles.handoffLinks}>
        <Link href={messageUrl}>Message {otherLabel} ↗</Link>
        {booking.viewerRole === "HUSTLER" && booking.status === "COMPLETED" && booking.hustler.username &&
          <Link href={`/u/${encodeURIComponent(booking.hustler.username)}#reviews`}>View your public reviews</Link>}
        {canReviewBooking && <Link href="#booking-review">{isolatedWebMode ? "Review completed booking (test)" : "Review completed booking"}</Link>}
        <Link href={`/services/${encodeURIComponent(booking.serviceId)}`}>View service details</Link>
        <Link href="/bookings">All bookings</Link>
      </div>
      <small>Messages help you consult; only Hustle's booking and payment records determine confirmed work or funding.</small>
    </section>

    <div className={styles.detailGrid}>
      <section className={styles.detailMain}>
        <article className={[styles.summaryCard, "h-experience-surface"].join(" ")}>
          <p className={styles.eyebrow}>{booking.viewerRole === "CLIENT" ? "YOUR SERVICE REQUEST" : "CUSTOMER SERVICE REQUEST"}</p>
          <h1 className="h-experience-heading">{booking.serviceTitleSnapshot}</h1>
          <div className={styles.meta}><ExperienceStatus kind="booking" value={booking.status} /><span>{formatBookingPrice(booking)}</span><span>with {other.displayName ?? other.username ?? "Hustle user"}</span></div>
          <p className={styles.next}>{booking.nextAction}</p>
        </article>
        <article className={[styles.summaryCard, "h-experience-surface"].join(" ")}>
          <p className={styles.eyebrow}>SCHEDULE</p>
          <div className={styles.facts}><Fact label="REQUESTED START" value={formatDate(booking.requestedStartAt)} /><Fact label="REQUESTED END" value={formatDate(booking.requestedEndAt)} /><Fact label="CONFIRMED START" value={formatDate(booking.confirmedStartAt)} /><Fact label="CONFIRMED END" value={formatDate(booking.confirmedEndAt)} /></div>
          {booking.actualStartedAt && <p className={styles.copy}>Actual work started: {formatDate(booking.actualStartedAt)}</p>}
          {booking.actualFinishedAt && <p className={styles.copy}>Actual work completed: {formatDate(booking.actualFinishedAt)}</p>}
          {booking.extendedMinutes > 0 && <p className={styles.flowTimeAvailable} role="status">Schedule extended by {booking.extendedMinutes} minutes in total. The agreed price is unchanged.</p>}
          {!isolatedWebMode && booking.viewerRole === "HUSTLER" && booking.status === "IN_PROGRESS" && booking.confirmedEndAt && (
            <div className={styles.flowTimeExtend}>
              <strong>Running late?</strong>
              <p>Extend the expected finish only if the shared team or equipment still has room. Other confirmed customers are protected; the Client is notified and the price stays unchanged.</p>
              {!extensionOpen ? <button type="button" disabled={busy} onClick={()=>setExtensionOpen(true)}>Review an extension</button> : <>
                <label>Extra time
                  <select value={extensionMinutes} onChange={(event)=>setExtensionMinutes(Number(event.target.value))}>
                    {[5,10,15,30,45,60,90,120].map((minutes)=><option key={minutes} value={minutes}>{minutes} minutes</option>)}
                  </select>
                </label>
                <label>Explanation to Client (optional)
                  <textarea maxLength={300} value={extensionNote} onChange={(event)=>setExtensionNote(event.target.value)} placeholder="The previous step took longer; I need a little more time."/>
                </label>
                <div className={styles.actions}>
                  <button type="button" disabled={busy} onClick={submitExtension}>Confirm extension & notify Client</button>
                  <button type="button" disabled={busy} onClick={()=>{setExtensionOpen(false);setExtensionNote("");}}>Keep current time</button>
                </div>
              </>}
            </div>
          )}
        </article>
        <article className={[styles.summaryCard, "h-experience-surface"].join(" ")}>
          <p className={styles.eyebrow}>REQUIREMENTS</p><p className={styles.copy}>{booking.requirements}</p>
          {booking.location && <><p className={styles.eyebrow}>LOCATION</p><p className={styles.copy}>{booking.location}</p></>}
          {booking.notes && <><p className={styles.eyebrow}>NOTES</p><p className={styles.copy}>{booking.notes}</p></>}
          {booking.declineReason && <><p className={styles.eyebrow}>DECLINE REASON</p><p className={styles.copy}>{booking.declineReason}</p></>}
          {booking.cancellationReason && <><p className={styles.eyebrow}>CANCELLATION REASON</p><p className={styles.copy}>{booking.cancellationReason}</p></>}
        </article>
      </section>

      <aside className={styles.detailSide}>
        <section className={styles.summaryCard}>
          <p className={styles.eyebrow}>TRANSACTION TERMS</p>
          <div className={styles.facts}><Fact label="PRICE" value={formatBookingPrice(booking)} /><Fact label="PRICING" value={booking.pricingTypeSnapshot.replaceAll("_", " ")} /><Fact label="SERVICE" value={booking.service.title ?? booking.serviceTitleSnapshot} /><Fact label="DELIVERY" value={booking.service.deliveryMode} /></div>
        </section>

        {booking.paymentBoundary.required && <div className={booking.paymentBoundary.funded ? styles.success : styles.payment}><strong>{booking.paymentBoundary.funded ? "Booking funding recorded" : "Payment boundary"}</strong><p>{booking.paymentBoundary.funded ? "This Booking has server-recorded funding evidence. Check Financial State below to distinguish sandbox simulation from external payment settlement." : booking.paymentBoundary.message ?? "Funding is confirmed only after authoritative payment evidence is received."}</p></div>}

        {!isolatedWebMode && booking.paymentBoundary.required && <section className={styles.summaryCard}>
          <p className={styles.eyebrow}>PAYMENT · ESCROW</p>
          <TransactionFinanceActions key={`BOOKING:${booking.id}`} subjectType="BOOKING" subjectId={booking.id} canInitialize={booking.viewerRole === "CLIENT" && booking.status === "PAYMENT_PENDING"} canRefund={booking.viewerRole === "CLIENT" && booking.status === "FUNDED"} canRelease={booking.viewerRole === "CLIENT" && booking.status === "COMPLETED"} releaseKind="BOOKING_ESCROW" onFinancialChange={load} />
        </section>}

        {!isolatedWebMode && <div id="booking-review" style={{ scrollMarginTop: 24 }}>
          <ReviewEligibilityCard key={`${booking.id}:${reviewRefreshKey}`} subjectType="BOOKING" subjectId={booking.id} />
        </div>}
        {!isolatedWebMode && <CounterpartyFeedbackCard subjectType="BOOKING" subjectId={booking.id} />}
        {!isolatedWebMode && <TransactionSafetyActions
          targetUserId={other.id}
          targetLabel={otherLabel}
          subjectType="BOOKING"
          subjectId={booking.id}
          messageHref={messageUrl}
        />}

        <section className={styles.summaryCard}>
          <p className={styles.eyebrow}>ACTIONS</p>
          <div className={styles.actions}>
            {canAccept && <><div className={styles.field}><label htmlFor="confirmed-start">CONFIRM START</label><input id="confirmed-start" type="datetime-local" value={confirmedStartAt} onChange={(event) => setConfirmedStartAt(event.target.value)} /></div><div className={styles.field}><label htmlFor="confirmed-end">CONFIRM END · OPTIONAL</label><input id="confirmed-end" type="datetime-local" value={confirmedEndAt} onChange={(event) => setConfirmedEndAt(event.target.value)} /></div><p className={styles.actionNote}>{isolatedWebMode ? "Accept only the Client's original time. Select a different time and use Suggest alternative to send the Client an actionable booking proposal. Accepted paid requests remain payment pending with no payment capability." : "Accepting a paid Booking moves it to payment pending; work cannot start without authoritative funding. Free Bookings can start after acceptance."}</p><button type="button" className={styles.primary} disabled={busy} onClick={() => void acceptWithSchedule()}>{isolatedWebMode ? "Accept requested time (test)" : "Accept with confirmed schedule"}</button>{isolatedWebMode && <button type="button" className={styles.secondary} disabled={busy} onClick={() => void proposeAlternateTime()}>Propose new time to Client</button>}<button type="button" className={styles.secondary} disabled={busy} onClick={() => openDecision("DECLINE")}>Decline request</button></>}
            {canStart && <button className={styles.primary} disabled={busy} onClick={() => void act(() => startBooking(booking.id))}>Start work</button>}
            {canComplete && <button className={styles.primary} disabled={busy} onClick={() => void act(() => completeBooking(booking.id))}>Mark work complete</button>}
            {canCancel && <button type="button" className={styles.danger} disabled={busy} onClick={() => openDecision("CANCEL")}>Cancel booking</button>}
            {decision && ((decision === "DECLINE" && canAccept) || (decision === "CANCEL" && canCancel)) && (
              <BookingDecisionPanel
                decision={decision}
                reason={decisionReason}
                onReasonChange={setDecisionReason}
                onDismiss={() => { setDecision(null); setDecisionReason(""); }}
                onConfirm={submitDecision}
                busy={busy}
              />
            )}
            <a className={styles.secondary} href={`/services/${booking.serviceId}`}>Open Service</a>
          </div>
          {error && <div className={styles.error}>{error}</div>}
        </section>
      </aside>
    </div>
    <footer className={styles.footer}><span>Created {formatDate(booking.createdAt)}</span><strong>{booking.id}</strong></footer>
  </main>;
}
