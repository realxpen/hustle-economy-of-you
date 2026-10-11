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
import { CounterpartyFeedbackCard } from "../../../components/trust/counterparty-feedback-card";
import { ReviewEligibilityCard } from "../../../components/trust/review-eligibility-card";
import { TransactionSafetyActions } from "../../../components/trust/transaction-safety-actions";
import {
  type BookingRecord,
  acceptBooking,
  cancelBooking,
  completeBooking,
  declineBooking,
  formatBookingPrice,
  getBooking,
  startBooking
} from "../../../lib/booking";
import styles from "../bookings.module.css";

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
  const requestVersion = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmedStartAt, setConfirmedStartAt] = useState("");
  const [confirmedEndAt, setConfirmedEndAt] = useState("");

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
    void load();
    return () => { requestVersion.current += 1; };
  }, [load]);

  async function act(action: () => Promise<BookingRecord>) {
    setBusy(true);
    setError(null);
    try {
      applyBooking(await action());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Booking action failed");
    } finally {
      setBusy(false);
    }
  }

  async function acceptWithSchedule() {
    if (!booking) return;
    const start = toIso(confirmedStartAt);
    const end = toIso(confirmedEndAt);
    if (!start) return setError("Choose a valid confirmed start date and time.");
    if (confirmedEndAt && !end) return setError("Choose a valid confirmed end date and time.");
    if (end && new Date(end).getTime() <= new Date(start).getTime()) return setError("Confirmed end must be after confirmed start.");
    await act(() => acceptBooking(booking.id, { confirmedStartAt: start, ...(end ? { confirmedEndAt: end } : {}) }));
  }

  const booking = storedBooking?.id === params?.bookingId ? storedBooking : null;
  if (error && !booking) return <main className={styles.shell}><ExperienceState kind="error" title="Booking unavailable." description={error} action={{label:"Retry booking",onClick:()=>void load()}} /></main>;
  if (!booking) return <main className={styles.shell}><ExperienceState kind="loading" title="Loading booking…" /></main>;

  const other = booking.viewerRole === "CLIENT" ? booking.hustler : booking.client;
  const otherLabel = other.displayName ?? other.username ?? "participant";
  const canCancel = booking.viewerRole === "CLIENT" ? ["REQUESTED", "ACCEPTED", "PAYMENT_PENDING"].includes(booking.status) : ["ACCEPTED", "PAYMENT_PENDING"].includes(booking.status);
  const canAccept = booking.viewerRole === "HUSTLER" && booking.status === "REQUESTED";
  const canStart = booking.viewerRole === "HUSTLER" && ["ACCEPTED", "FUNDED"].includes(booking.status);
  const canComplete = booking.viewerRole === "HUSTLER" && booking.status === "IN_PROGRESS";
  const messageUrl = withTransactionReturnTo(
    booking.conversationId ? `/messages/${encodeURIComponent(booking.conversationId)}`
      : `/messages/start?userId=${encodeURIComponent(other.id)}&contextType=SERVICE&contextId=${encodeURIComponent(booking.serviceId)}`,
    `/bookings/${encodeURIComponent(booking.id)}`
  );

  return <main className={[styles.shell, "h-experience-shell"].join(" ")}>
    <ExperienceHeader section="Booking detail" trail={[{ href: "/bookings", label: "Bookings" }]}
      secondaryLinks={[{ href: `/services/${booking.serviceId}`, label: "Service" }, { href: "/messages", label: "Messages" }, { href: "/wallet", label: "Wallet" }]} />

    <TransactionJourney kind="BOOKING" status={booking.status} />
    <section className={styles.handoff} aria-label="Booking next steps">
      <div><strong>Next step</strong><p>{booking.nextAction ?? "Check your booking status or discuss the details in Messages."}</p></div>
      <div className={styles.handoffLinks}>
        <Link href={messageUrl}>Message {otherLabel} ↗</Link>
        <Link href={`/services/${encodeURIComponent(booking.serviceId)}`}>Review service</Link>
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

        {booking.paymentBoundary.required && <div className={booking.paymentBoundary.funded ? styles.success : styles.payment}><strong>{booking.paymentBoundary.funded ? "Funding confirmed" : "Payment boundary"}</strong><p>{booking.paymentBoundary.funded ? "This Booking has authoritative funding evidence." : booking.paymentBoundary.message ?? "Funding is confirmed only after authoritative payment evidence is received."}</p></div>}

        {booking.paymentBoundary.required && <section className={styles.summaryCard}>
          <p className={styles.eyebrow}>PAYMENT · ESCROW</p>
          <TransactionFinanceActions subjectType="BOOKING" subjectId={booking.id} canInitialize={booking.viewerRole === "CLIENT" && booking.status === "PAYMENT_PENDING"} canRefund={booking.viewerRole === "CLIENT" && booking.status === "FUNDED"} canRelease={booking.viewerRole === "CLIENT" && booking.status === "COMPLETED"} releaseKind="BOOKING_ESCROW" onFinancialChange={load} />
        </section>}

        <ReviewEligibilityCard subjectType="BOOKING" subjectId={booking.id} />
        <CounterpartyFeedbackCard subjectType="BOOKING" subjectId={booking.id} />
        <TransactionSafetyActions
          targetUserId={other.id}
          targetLabel={otherLabel}
          subjectType="BOOKING"
          subjectId={booking.id}
          messageHref={messageUrl}
        />

        <section className={styles.summaryCard}>
          <p className={styles.eyebrow}>ACTIONS</p>
          <div className={styles.actions}>
            {canAccept && <><div className={styles.field}><label htmlFor="confirmed-start">CONFIRM START</label><input id="confirmed-start" type="datetime-local" value={confirmedStartAt} onChange={(event) => setConfirmedStartAt(event.target.value)} /></div><div className={styles.field}><label htmlFor="confirmed-end">CONFIRM END · OPTIONAL</label><input id="confirmed-end" type="datetime-local" value={confirmedEndAt} onChange={(event) => setConfirmedEndAt(event.target.value)} /></div><button className={styles.primary} disabled={busy} onClick={() => void acceptWithSchedule()}>Accept with confirmed schedule</button><button className={styles.secondary} disabled={busy} onClick={() => { const reason = window.prompt("Optional decline reason") ?? undefined; void act(() => declineBooking(booking.id, reason)); }}>Decline request</button></>}
            {canStart && <button className={styles.primary} disabled={busy} onClick={() => void act(() => startBooking(booking.id))}>Start work</button>}
            {canComplete && <button className={styles.primary} disabled={busy} onClick={() => void act(() => completeBooking(booking.id))}>Mark work complete</button>}
            {canCancel && <button className={styles.danger} disabled={busy} onClick={() => { const reason = window.prompt("Optional cancellation reason") ?? undefined; void act(() => cancelBooking(booking.id, reason)); }}>Cancel booking</button>}
            <a className={styles.secondary} href={`/services/${booking.serviceId}`}>Open Service</a>
          </div>
          {error && <div className={styles.error}>{error}</div>}
        </section>
      </aside>
    </div>
    <footer className={styles.footer}><span>Created {formatDate(booking.createdAt)}</span><strong>{booking.id}</strong></footer>
  </main>;
}
