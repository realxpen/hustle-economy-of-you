"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
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
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "full",
    timeStyle: "short"
  }).format(new Date(value));
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
  const [booking, setBooking] = useState<BookingRecord | null>(null);
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
    try {
      setError(null);
      applyBooking(await getBooking(id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load booking");
    }
  }, [applyBooking, params?.bookingId]);

  useEffect(() => { void load(); }, [load]);

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
    if (!start) {
      setError("Choose a valid confirmed start date and time.");
      return;
    }
    if (confirmedEndAt && !end) {
      setError("Choose a valid confirmed end date and time.");
      return;
    }
    if (end && new Date(end).getTime() <= new Date(start).getTime()) {
      setError("Confirmed end must be after confirmed start.");
      return;
    }

    await act(() => acceptBooking(booking.id, {
      confirmedStartAt: start,
      ...(end ? { confirmedEndAt: end } : {})
    }));
  }

  if (error && !booking) return <main className={styles.shell}><div className={styles.formWrap}><div className={styles.error}>{error}</div><p><a href="/bookings">← Back to bookings</a></p></div></main>;
  if (!booking) return <main className={styles.shell}><p className={styles.loading}>Loading booking…</p></main>;

  const other = booking.viewerRole === "CLIENT" ? booking.hustler : booking.client;
  const canCancel = booking.viewerRole === "CLIENT"
    ? ["REQUESTED", "ACCEPTED", "PAYMENT_PENDING"].includes(booking.status)
    : ["ACCEPTED", "PAYMENT_PENDING"].includes(booking.status);
  const canAccept = booking.viewerRole === "HUSTLER" && booking.status === "REQUESTED";
  const canStart = booking.viewerRole === "HUSTLER" && ["ACCEPTED", "FUNDED"].includes(booking.status);
  const canComplete = booking.viewerRole === "HUSTLER" && booking.status === "IN_PROGRESS";
  const messageUrl = booking.conversationId
    ? `/messages/${booking.conversationId}`
    : `/messages/start?userId=${encodeURIComponent(other.id)}`;

  return <main className={styles.shell}>
    <header className={styles.header}>
      <a className={styles.brand} href="/">HUSTLE↗</a>
      <nav><a href="/bookings">Bookings</a><a href={`/services/${booking.serviceId}`}>Service</a><a href={messageUrl}>Messages</a></nav>
    </header>

    <div className={styles.detailGrid}>
      <section className={styles.detailMain}>
        <article className={styles.summaryCard}>
          <p className={styles.eyebrow}>{booking.viewerRole} VIEW · BOOKING</p>
          <h1>{booking.serviceTitleSnapshot}</h1>
          <div className={styles.meta}><span className={styles.status}>{booking.status.replaceAll("_", " ")}</span><span>{formatBookingPrice(booking)}</span><span>with {other.displayName ?? other.username ?? "Hustle user"}</span></div>
          <p className={styles.next}>{booking.nextAction}</p>
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
          <p className={styles.eyebrow}>REQUIREMENTS</p>
          <p className={styles.copy}>{booking.requirements}</p>
          {booking.location && <><p className={styles.eyebrow}>LOCATION</p><p className={styles.copy}>{booking.location}</p></>}
          {booking.notes && <><p className={styles.eyebrow}>NOTES</p><p className={styles.copy}>{booking.notes}</p></>}
          {booking.declineReason && <><p className={styles.eyebrow}>DECLINE REASON</p><p className={styles.copy}>{booking.declineReason}</p></>}
          {booking.cancellationReason && <><p className={styles.eyebrow}>CANCELLATION REASON</p><p className={styles.copy}>{booking.cancellationReason}</p></>}
        </article>
      </section>

      <aside className={styles.detailSide}>
        <section className={styles.summaryCard}>
          <p className={styles.eyebrow}>TRANSACTION TERMS</p>
          <div className={styles.facts}>
            <Fact label="PRICE" value={formatBookingPrice(booking)} />
            <Fact label="PRICING" value={booking.pricingTypeSnapshot.replaceAll("_", " ")} />
            <Fact label="SERVICE" value={booking.service.title ?? booking.serviceTitleSnapshot} />
            <Fact label="DELIVERY" value={booking.service.deliveryMode} />
          </div>
        </section>

        {booking.paymentBoundary.required && <div className={booking.paymentBoundary.funded ? styles.success : styles.payment}>
          <strong>{booking.paymentBoundary.funded ? "Funding confirmed" : "Payment boundary"}</strong>
          <p>{booking.paymentBoundary.funded ? "This Booking has authoritative funding evidence." : booking.paymentBoundary.message ?? "Phase 13 owns payment and escrow confirmation."}</p>
        </div>}

        <section className={styles.summaryCard}>
          <p className={styles.eyebrow}>ACTIONS</p>
          <div className={styles.actions}>
            {canAccept && <>
              <div className={styles.field}>
                <label htmlFor="confirmed-start">CONFIRM START</label>
                <input id="confirmed-start" type="datetime-local" value={confirmedStartAt} onChange={(event) => setConfirmedStartAt(event.target.value)} />
              </div>
              <div className={styles.field}>
                <label htmlFor="confirmed-end">CONFIRM END · OPTIONAL</label>
                <input id="confirmed-end" type="datetime-local" value={confirmedEndAt} onChange={(event) => setConfirmedEndAt(event.target.value)} />
              </div>
              <button className={styles.primary} disabled={busy} onClick={() => void acceptWithSchedule()}>Accept with confirmed schedule</button>
              <button className={styles.secondary} disabled={busy} onClick={() => {
                const reason = window.prompt("Optional decline reason") ?? undefined;
                void act(() => declineBooking(booking.id, reason));
              }}>Decline request</button>
            </>}
            {canStart && <button className={styles.primary} disabled={busy} onClick={() => void act(() => startBooking(booking.id))}>Start work</button>}
            {canComplete && <button className={styles.primary} disabled={busy} onClick={() => void act(() => completeBooking(booking.id))}>Mark work complete</button>}
            {canCancel && <button className={styles.danger} disabled={busy} onClick={() => {
              const reason = window.prompt("Optional cancellation reason") ?? undefined;
              void act(() => cancelBooking(booking.id, reason));
            }}>Cancel booking</button>}
            <a className={styles.secondary} href={messageUrl}>Message {other.displayName ?? other.username ?? "participant"}</a>
            <a className={styles.secondary} href={`/services/${booking.serviceId}`}>Open Service</a>
          </div>
          {error && <div className={styles.error}>{error}</div>}
        </section>
      </aside>
    </div>

    <footer className={styles.footer}><span>Created {formatDate(booking.createdAt)}</span><strong>{booking.id}</strong></footer>
  </main>;
}
