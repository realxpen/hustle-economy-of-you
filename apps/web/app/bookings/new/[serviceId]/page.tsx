"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createBooking } from "../../../../lib/booking";
import { openDirectConversation } from "../../../../lib/messaging";
import { formatServicePrice, getPublicService } from "../../../../lib/service";
import type { PublicService } from "@hustle/types";
import styles from "../../bookings.module.css";

function toIso(value: string) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

export default function NewBookingPage() {
  const params = useParams<{ serviceId: string }>();
  const router = useRouter();
  const [data, setData] = useState<PublicService | null>(null);
  const [requestedStartAt, setRequestedStartAt] = useState("");
  const [requestedEndAt, setRequestedEndAt] = useState("");
  const [requirements, setRequirements] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const serviceId = params?.serviceId;
    if (!serviceId) return;
    getPublicService(serviceId)
      .then((service) => {
        setData(service);
        setLocation(service.service.location ?? service.owner.location ?? "");
      })
      .catch((reason: Error) => setError(reason.message));
  }, [params?.serviceId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data) return;
    const start = toIso(requestedStartAt);
    const end = toIso(requestedEndAt);
    if (!start) {
      setError("Choose a valid requested start date and time.");
      return;
    }
    if (requestedEndAt && !end) {
      setError("Choose a valid requested end date and time.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const direct = await openDirectConversation(data.owner.id);
      const booking = await createBooking({
        serviceId: data.service.id,
        requestedStartAt: start,
        ...(end ? { requestedEndAt: end } : {}),
        requirements,
        ...(location.trim() ? { location: location.trim() } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        conversationId: direct.conversation.id
      });
      router.push(`/bookings/${booking.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create booking request");
    } finally {
      setSubmitting(false);
    }
  }

  if (error && !data) return <main className={styles.shell}><div className={styles.formWrap}><div className={styles.error}>{error}</div><p><a href="/marketplace">← Back to Marketplace</a></p></div></main>;
  if (!data) return <main className={styles.shell}><p className={styles.loading}>Loading Service…</p></main>;

  const { service, owner } = data;

  return <main className={styles.shell}>
    <header className={styles.header}>
      <a className={styles.brand} href="/">HUSTLE↗</a>
      <nav><a href={`/services/${service.id}`}>Service</a><a href="/bookings">Bookings</a><a href="/messages">Messages</a></nav>
    </header>

    <div className={styles.formWrap}>
      <section className={styles.formHero}>
        <article className={styles.offerCard}>
          <p className={styles.eyebrow}>BOOK SERVICE</p>
          <h1>{service.title}</h1>
          <p className={styles.price}>{formatServicePrice(service)}</p>
          <p>By {owner.displayName ?? `@${owner.username}`} · {service.deliveryMode}</p>
          <p>This request preserves the Service, price basis and schedule as transaction history. Payment is not collected in this phase.</p>
        </article>
        <aside className={styles.offerCard}>
          <p className={styles.eyebrow}>HOW IT WORKS</p>
          <p>1. Choose a requested time.</p>
          <p>2. Describe what you need.</p>
          <p>3. The Hustler accepts or declines.</p>
          <p>4. Paid bookings stop at PAYMENT PENDING until Phase 13 funding confirmation.</p>
        </aside>
      </section>

      <form className={styles.formCard} onSubmit={submit}>
        <div className={styles.grid2}>
          <div className={styles.field}>
            <label htmlFor="start">REQUESTED START</label>
            <input id="start" type="datetime-local" required value={requestedStartAt} onChange={(event) => setRequestedStartAt(event.target.value)} />
          </div>
          <div className={styles.field}>
            <label htmlFor="end">REQUESTED END · OPTIONAL</label>
            <input id="end" type="datetime-local" value={requestedEndAt} onChange={(event) => setRequestedEndAt(event.target.value)} />
          </div>
        </div>

        <div className={styles.field}>
          <label htmlFor="requirements">WHAT DO YOU NEED?</label>
          <textarea id="requirements" required maxLength={4000} value={requirements} onChange={(event) => setRequirements(event.target.value)} placeholder="Describe the project, expected outcome, important features, constraints and deadline." />
        </div>

        <div className={styles.grid2}>
          <div className={styles.field}>
            <label htmlFor="location">LOCATION · OPTIONAL</label>
            <input id="location" maxLength={300} value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Lagos, Nigeria" />
          </div>
          <div className={styles.field}>
            <label htmlFor="notes">NOTES · OPTIONAL</label>
            <input id="notes" maxLength={2000} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Anything else the Hustler should know" />
          </div>
        </div>

        {error && <div className={styles.error}>{error}</div>}
        <button className={styles.primary} disabled={submitting || !requirements.trim()}>{submitting ? "Submitting request…" : "Submit booking request →"}</button>
      </form>
    </div>
  </main>;
}
