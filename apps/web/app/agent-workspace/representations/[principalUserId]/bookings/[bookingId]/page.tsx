"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";

import {
  acceptAgentBooking,
  cancelAgentBooking,
  declineAgentBooking,
  getAgentBooking,
  startAgentBooking,
  type AgentBookingRecord
} from "../../../../../../lib/agent-client-operations";
import { formatBookingPrice } from "../../../../../../lib/booking";
import styles from "../../../../../bookings/bookings.module.css";

function formatDate(value: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-NG", { dateStyle: "full", timeStyle: "short" }).format(new Date(value));
}

function toLocalInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function toIso(value: string) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div className={styles.fact}><small>{label}</small><strong>{value}</strong></div>;
}

export default function RepresentedBookingDetailPage() {
  const { principalUserId, bookingId } = useParams<{ principalUserId: string; bookingId: string }>();
  const [booking, setBooking] = useState<AgentBookingRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmedStartAt, setConfirmedStartAt] = useState("");
  const [confirmedEndAt, setConfirmedEndAt] = useState("");
  const [reason, setReason] = useState("");

  const workspaceHref = `/agent-workspace/representations/${encodeURIComponent(principalUserId)}`;

  const applyBooking = useCallback((next: AgentBookingRecord) => {
    setBooking(next);
    if (next.status === "REQUESTED") {
      setConfirmedStartAt(toLocalInput(next.confirmedStartAt ?? next.requestedStartAt));
      setConfirmedEndAt(toLocalInput(next.confirmedEndAt ?? next.requestedEndAt));
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    // Drop any prior principal's request details before re-checking authority.
    setBooking(null);
    try {
      applyBooking(await getAgentBooking(principalUserId, bookingId));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not access this represented Booking");
    } finally {
      setLoading(false);
    }
  }, [principalUserId, bookingId, applyBooking]);

  useEffect(() => { void load(); }, [load]);

  async function act(action: () => Promise<AgentBookingRecord>, message: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      applyBooking(await action());
      setReason("");
      setNotice(message);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Booking action failed");
      // Re-check permissions and the latest state if an action is denied.
      try {
        applyBooking(await getAgentBooking(principalUserId, bookingId));
      } catch {
        setBooking(null);
      }
    } finally {
      setBusy(false);
    }
  }

  async function acceptWithSchedule() {
    if (!booking) return;
    const start = toIso(confirmedStartAt);
    const end = toIso(confirmedEndAt);
    if (!start) { setError("Choose a valid confirmed start date and time."); return; }
    if (confirmedEndAt && !end) { setError("Choose a valid confirmed end date and time."); return; }
    if (end && new Date(end).getTime() <= new Date(start).getTime()) {
      setError("Confirmed end must be after confirmed start."); return;
    }
    await act(
      () => acceptAgentBooking(principalUserId, booking.id, {
        confirmedStartAt: start,
        ...(end ? { confirmedEndAt: end } : {})
      }),
      "Booking accepted for the represented Hustler. The Agent action was audited."
    );
  }

  if (loading) return <main className={styles.shell}><p className={styles.loading}>Checking delegated Booking access…</p></main>;
  if (!booking) return <main className={styles.shell}><div className={styles.formWrap}>
    <p className={styles.error} role="alert">{error ?? "This Booking is unavailable to your Agent account."}</p>
    <a href={workspaceHref}>← Back to represented workspace</a>
  </div></main>;

  const allowed = booking.agentAllowedActions;
  const client = booking.client;
  const clientLabel = client.displayName ?? client.username ?? "Hustle client";

  return <main className={styles.shell}>
    <header className={styles.header}>
      <a className={styles.brand} href="/">HUSTLE↗</a>
      <nav>
        <a href={workspaceHref}>← Represented workspace</a>
        <a href={`/services/${encodeURIComponent(booking.serviceId)}`}>Service</a>
      </nav>
    </header>

    <div className={styles.detailGrid}>
      <section className={styles.detailMain}>
        <article className={styles.summaryCard}>
          <p className={styles.eyebrow}>AGENT VIEW · REPRESENTED BOOKING</p>
          <h1>{booking.serviceTitleSnapshot}</h1>
          <div className={styles.meta}>
            <span className={styles.status}>{booking.status.replaceAll("_", " ")}</span>
            <span>{formatBookingPrice(booking)}</span>
            <span>Client: {clientLabel}</span>
          </div>
          <p className={styles.next}>{booking.nextAction ?? "No delegated action available at this stage."}</p>
        </article>

        <article className={styles.summaryCard}>
          <p className={styles.eyebrow}>CLIENT &amp; SERVICE</p>
          <div className={styles.facts}>
            <Fact label="CLIENT" value={clientLabel} />
            <Fact label="CLIENT ID" value={client.id} />
            <Fact label="SERVICE" value={booking.service.title ?? booking.serviceTitleSnapshot} />
            <Fact label="CATEGORY" value={booking.service.category ?? "Not specified"} />
            <Fact label="DELIVERY" value={booking.service.deliveryMode.replaceAll("_", " ")} />
            <Fact label="BOOKED FOR" value={booking.hustler.displayName ?? booking.hustler.username ?? "Represented Hustler"} />
          </div>
        </article>

        <article className={styles.summaryCard}>
          <p className={styles.eyebrow}>SCHEDULE</p>
          <div className={styles.facts}>
            <Fact label="REQUESTED START" value={formatDate(booking.requestedStartAt)} />
            <Fact label="REQUESTED END" value={formatDate(booking.requestedEndAt)} />
            <Fact label="CONFIRMED START" value={formatDate(booking.confirmedStartAt)} />
            <Fact label="CONFIRMED END" value={formatDate(booking.confirmedEndAt)} />
          </div>
        </article>

        <article className={styles.summaryCard}>
          <p className={styles.eyebrow}>CLIENT REQUIREMENTS</p>
          <p className={styles.copy}>{booking.requirements}</p>
          {booking.location && <><p className={styles.eyebrow}>SERVICE LOCATION</p><p className={styles.copy}>{booking.location}</p></>}
          {booking.notes && <><p className={styles.eyebrow}>ADDITIONAL NOTES</p><p className={styles.copy}>{booking.notes}</p></>}
          {booking.declineReason && <><p className={styles.eyebrow}>DECLINE REASON</p><p className={styles.copy}>{booking.declineReason}</p></>}
          {booking.cancellationReason && <><p className={styles.eyebrow}>CANCELLATION REASON</p><p className={styles.copy}>{booking.cancellationReason}</p></>}
        </article>
      </section>

      <aside className={styles.detailSide}>
        <article className={styles.summaryCard}>
          <p className={styles.eyebrow}>BOOKING TERMS</p>
          <div className={styles.facts}>
            <Fact label="AGREED PRICE" value={formatBookingPrice(booking)} />
            <Fact label="PRICING TYPE" value={booking.pricingTypeSnapshot.replaceAll("_", " ")} />
            <Fact label="CREATED" value={formatDate(booking.createdAt)} />
            <Fact label="BOOKING ID" value={booking.id} />
          </div>
        </article>

        {booking.paymentBoundary.required && <section className={booking.paymentBoundary.funded ? styles.success : styles.payment}>
          <strong>{booking.paymentBoundary.funded ? "Funding confirmed" : "Payment boundary"}</strong>
          <p>{booking.paymentBoundary.funded
            ? "Funding was confirmed by the payment system. Agent actions remain operational only."
            : booking.paymentBoundary.message ?? "Only the Client and payment system can confirm funding."}</p>
        </section>}

        <article className={styles.summaryCard}>
          <p className={styles.eyebrow}>AGENT BOOKING ACTIONS</p>
          <p className={styles.copy}>You act for the represented Hustler only while BOOKING_MANAGE is granted. Payment, escrow, completion, and reputation remain outside your authority.</p>
          {notice && <div className={styles.success} role="status">{notice}</div>}
          {error && <div className={styles.error} role="alert">{error}</div>}
          <div className={styles.actions}>
            {allowed.includes("ACCEPT") && <>
              <div className={styles.field}>
                <label htmlFor="agent-confirmed-start">CONFIRMED START</label>
                <input id="agent-confirmed-start" type="datetime-local" value={confirmedStartAt} onChange={(e) => setConfirmedStartAt(e.target.value)} disabled={busy} />
              </div>
              <div className={styles.field}>
                <label htmlFor="agent-confirmed-end">CONFIRMED END · OPTIONAL</label>
                <input id="agent-confirmed-end" type="datetime-local" value={confirmedEndAt} onChange={(e) => setConfirmedEndAt(e.target.value)} disabled={busy} />
              </div>
              <button className={styles.primary} disabled={busy || !confirmedStartAt} onClick={() => void acceptWithSchedule()}>Accept with confirmed schedule</button>
            </>}
            {(allowed.includes("DECLINE") || allowed.includes("CANCEL")) && <div className={styles.field}>
              <label htmlFor="agent-booking-reason">REASON · OPTIONAL</label>
              <textarea id="agent-booking-reason" rows={3} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} disabled={busy} placeholder="Brief reason for the client" />
            </div>}
            {allowed.includes("DECLINE") && <button className={styles.secondary} disabled={busy} onClick={() => void act(() => declineAgentBooking(principalUserId, booking.id, reason.trim() || undefined), "Request declined on behalf of the Hustler.")}>Decline request</button>}
            {allowed.includes("CANCEL") && <button className={styles.danger} disabled={busy} onClick={() => void act(() => cancelAgentBooking(principalUserId, booking.id, reason.trim() || undefined), "Booking cancelled before funded work.")}>Cancel booking</button>}
            {allowed.includes("START") && <button className={styles.primary} disabled={busy} onClick={() => void act(() => startAgentBooking(principalUserId, booking.id), "Work started under the delegated Booking permission.")}>Start work</button>}
            {allowed.length === 0 && <p className={styles.copy}>No Booking mutations are permitted at this stage.</p>}
          </div>
          <a className={styles.secondary} href={workspaceHref}>Back to represented workspace</a>
        </article>
      </aside>
    </div>
    <footer className={styles.footer}><span>Agent view · original Booking ownership stays with the Hustler.</span><strong>{booking.id}</strong></footer>
  </main>;
}
