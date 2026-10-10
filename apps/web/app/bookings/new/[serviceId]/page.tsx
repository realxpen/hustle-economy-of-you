"use client";

import { FormEvent, useEffect, useState } from "react";
import { ExperienceHeader } from "../../../../components/navigation/experience-header";
import { ExperienceState } from "../../../../components/experience/experience-state";
import { useParams, useRouter } from "next/navigation";
import { checkBookingAvailability, createBooking } from "../../../../lib/booking";
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
    if (!data || submitting) return;
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
    if (end && start && new Date(end).getTime() <= new Date(start).getTime()) {
      setError("The requested end must be later than the requested start.");
      return;
    }
    if (!requirements.trim()) {
      setError("Describe what you need before sending this request.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const availability = await checkBookingAvailability({
        serviceId: data.service.id,
        startAt: start,
        ...(end ? { endAt: end } : {})
      });
      if (!availability.available) {
        setError(availability.reason ?? "That time is not currently available.");
        return;
      }

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

  if (error && !data) return <main className={styles.shell}><ExperienceState kind="error" title="Service details unavailable." description={error} action={{ label: "Explore Services", href: "/marketplace" }} /></main>;
  if (!data) return <main className={styles.shell}><ExperienceState kind="loading" title="Loading Service and schedule…" /></main>;

  const { service, owner } = data;

  return <main className={[styles.shell, "h-experience-shell"].join(" ")}>
    <ExperienceHeader section="Request a Booking"
      trail={[{ href: "/marketplace", label: "Marketplace" }, { href: `/services/${service.id}`, label: "Service" }]}
      secondaryLinks={[{ href: "/bookings", label: "Your bookings" }, { href: "/messages", label: "Messages" }]} />

    <div className={styles.formWrap}>
      <section className={styles.formHero}>
        <article className={styles.offerCard}>
          <p className={styles.eyebrow}>BOOK SERVICE</p>
          <h1>{service.title}</h1>
          <p className={styles.price}>{formatServicePrice(service)}</p>
          <p>By {owner.displayName ?? `@${owner.username}`} · {service.deliveryMode}</p>
          <p>This request preserves the Service, price basis and schedule as transaction history. You will review payment only if the Hustler accepts a paid Booking; submitting this request does not charge you.</p>
        </article>
        <aside className={styles.offerCard}>
          <p className={styles.eyebrow}>HOW IT WORKS</p>
          <p>1. Choose a requested time. Hustle checks it against already confirmed work.</p>
          <p>2. Describe what you need.</p>
          <p>3. The Hustler accepts, adjusts the confirmed time, or declines.</p>
          <p>4. Any paid Booking stays payment pending until the payment provider confirms funding.</p>
        </aside>
      </section>

      <form className={styles.formCard} onSubmit={submit} aria-busy={submitting} aria-describedby="booking-form-help">
        <p id="booking-form-help" className="h-ui-subtitle">Only the requested start and project description are required. We check availability before sending the request.</p>
        <div className={styles.grid2}>
          <div className={styles.field}>
            <label htmlFor="start">REQUESTED START</label>
            <input id="start" type="datetime-local" required aria-invalid={Boolean(error && error.includes("start"))} value={requestedStartAt} onChange={(event) => setRequestedStartAt(event.target.value)} />
          </div>
          <div className={styles.field}>
            <label htmlFor="end">REQUESTED END · OPTIONAL</label>
            <input id="end" type="datetime-local" aria-invalid={Boolean(error && error.includes("end"))} value={requestedEndAt} onChange={(event) => setRequestedEndAt(event.target.value)} />
          </div>
        </div>

        <div className={styles.field}>
          <label htmlFor="requirements">WHAT DO YOU NEED?</label>
          <textarea id="requirements" required maxLength={4000} aria-describedby="requirements-hint" value={requirements} onChange={(event) => setRequirements(event.target.value)} placeholder="Describe the project, expected outcome, important features, constraints and deadline." />
          <small id="requirements-hint">Explain the outcome you need. {requirements.length}/4000 characters.</small>
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

        {error && <div className={styles.error} role="alert" id="booking-form-error">{error}</div>}
        <button className={styles.primary} type="submit" aria-busy={submitting} disabled={submitting || !requirements.trim()}>{submitting ? "Checking schedule…" : "Submit booking request →"}</button>
      </form>
    </div>
  </main>;
}
