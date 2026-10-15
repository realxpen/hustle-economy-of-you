"use client";

import { FormEvent, useEffect, useState } from "react";
import { ExperienceHeader } from "../../../../components/navigation/experience-header";
import { ExperienceState } from "../../../../components/experience/experience-state";
import { useParams, useRouter } from "next/navigation";
import { OpportunityContext } from "../../../../components/commerce/opportunity-context";
import { useSourcePost, withSourcePost } from "../../../../lib/opportunity-source";
import { withTransactionReturnTo } from "../../../../lib/transaction-return";
import { checkBookingAvailability, createBooking } from "../../../../lib/booking";
import { openDirectConversation } from "../../../../lib/messaging";
import { authUrlFor } from "../../../../lib/auth/safe-auth-next";
import { getSupabaseBrowserClient } from "../../../../lib/supabase/client";
import {
  clearBookingDraft, readBookingDraft, saveBookingDraft,
  type BookingDraftFields
} from "../../../../lib/booking-draft";
import { formatServicePrice, getPublicService } from "../../../../lib/service";
import type { PublicService } from "@hustle/types";
import styles from "../../bookings.module.css";

function tabStorage(): Storage | null {
  try { return window.sessionStorage; } catch { return null; }
}

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
  const [retryVersion, setRetryVersion] = useState(0);
  const [draftPresent, setDraftPresent] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const sourcePostId = useSourcePost();

  useEffect(() => {
    const serviceId = params?.serviceId;
    if (!serviceId) return;
    let active = true;
    setData(null);
    setError(null);
    setDraftPresent(false);
    setDraftRestored(false);
    void getPublicService(serviceId)
      .then((service) => {
        if (!active) return;
        setData(service);
        const draft = readBookingDraft(tabStorage(), serviceId);
        if (draft) {
          setRequestedStartAt(draft.requestedStartAt);
          setRequestedEndAt(draft.requestedEndAt);
          setRequirements(draft.requirements);
          setLocation(draft.location);
          setNotes(draft.notes);
          setDraftPresent(true);
          setDraftRestored(true);
        } else {
          setRequestedStartAt("");
          setRequestedEndAt("");
          setRequirements("");
          setLocation(service.service.location ?? service.owner.location ?? "");
          setNotes("");
        }
      })
      .catch((reason: Error) => { if (active) setError(reason.message); });
    return () => { active = false; };
  }, [params?.serviceId, retryVersion]);

  function draftFields(): BookingDraftFields {
    return { requestedStartAt, requestedEndAt, requirements, location, notes };
  }

  function updateDraft(patch: Partial<BookingDraftFields>) {
    const serviceId = params?.serviceId;
    if (!serviceId) return;
    const saved = saveBookingDraft(tabStorage(), serviceId, { ...draftFields(), ...patch });
    setDraftPresent(saved);
    setDraftRestored(false);
  }

  function discardDraft() {
    const serviceId = params?.serviceId;
    if (serviceId) clearBookingDraft(tabStorage(), serviceId);
    setRequestedStartAt("");
    setRequestedEndAt("");
    setRequirements("");
    setNotes("");
    setLocation(data?.service.location ?? data?.owner.location ?? "");
    setDraftPresent(false);
    setDraftRestored(false);
    setError(null);
  }

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
      // Preserve the prepared request before an authentication handoff.
      saveBookingDraft(tabStorage(), data.service.id, draftFields());
      const { data: { session }, error: authError } = await getSupabaseBrowserClient().auth.getSession();
      if (authError) throw authError;
      if (!session?.access_token) {
        window.location.assign(authUrlFor(window.location.pathname + window.location.search));
        return;
      }

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
      clearBookingDraft(tabStorage(), data.service.id);
      setDraftPresent(false);
      router.push(`/bookings/${booking.id}`);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Could not create booking request";
      if (/sign in again|need to sign in/i.test(message)) {
        window.location.assign(authUrlFor(window.location.pathname + window.location.search));
        return;
      }
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  const currentData = data?.service.id === params?.serviceId ? data : null;
  if (error && !currentData) return <main className={styles.shell}><ExperienceState kind="error" title="Service details unavailable." description={error} action={{ label: "Try loading again", onClick: () => setRetryVersion((n) => n + 1) }} /></main>;
  if (!currentData) return <main className={styles.shell}><ExperienceState kind="loading" title="Loading Service and schedule…" /></main>;

  const { service, owner } = currentData;
  const bookingReturn = withSourcePost(`/bookings/new/${encodeURIComponent(service.id)}`, sourcePostId);
  const consultHref = withTransactionReturnTo(
    `/messages/start?userId=${encodeURIComponent(owner.id)}&contextType=SERVICE&contextId=${encodeURIComponent(service.id)}`,
    bookingReturn
  );

  return <main className={[styles.shell, "h-experience-shell"].join(" ")}>
    <ExperienceHeader section="Request a Booking"
      trail={[{ href: "/marketplace", label: "Marketplace" }, { href: `/services/${service.id}`, label: "Service" }]}
      secondaryLinks={[{ href: "/bookings", label: "Your bookings" }, { href: "/messages", label: "Messages" }]} />

    <OpportunityContext sourcePostId={sourcePostId} ownerUsername={owner.username}
      offerHref={`/services/${encodeURIComponent(service.id)}`} offerLabel="Review service" />
    <div className={styles.bookingConsult}>
      <div><strong>Want to clarify the job first?</strong><span>Ask questions about scope, timing, or pricing, then return to this Booking request. Your draft stays in this tab.</span></div>
      <a href={consultHref}>
        Consult {owner.displayName ?? owner.username ?? "Hustler"} ↗
      </a>
    </div>
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
        <p id="booking-form-help" className="h-ui-subtitle">Only the requested start and project description are required. We check availability before sending the request. If you need to sign in, your draft will still be here when you return.</p>
        <div className={styles.draftStatus} role="status">
          <span>{draftRestored
            ? "Draft restored — finish your request when ready."
            : draftPresent
              ? "Draft saved in this tab. Nothing has been sent or charged."
              : "Your draft is stored only in this browser tab for up to 2 hours as you type."}</span>
          {draftPresent && <button type="button" onClick={discardDraft} disabled={submitting}>Clear draft</button>}
        </div>
        <div className={styles.grid2}>
          <div className={styles.field}>
            <label htmlFor="start">REQUESTED START</label>
            <input id="start" type="datetime-local" required aria-invalid={Boolean(error && error.includes("start"))} value={requestedStartAt} onChange={(event) => { setRequestedStartAt(event.target.value); updateDraft({ requestedStartAt: event.target.value }); if (error) setError(null); }} />
          </div>
          <div className={styles.field}>
            <label htmlFor="end">REQUESTED END · OPTIONAL</label>
            <input id="end" type="datetime-local" aria-invalid={Boolean(error && error.includes("end"))} value={requestedEndAt} onChange={(event) => { setRequestedEndAt(event.target.value); updateDraft({ requestedEndAt: event.target.value }); if (error) setError(null); }} />
          </div>
        </div>

        <div className={styles.field}>
          <label htmlFor="requirements">WHAT DO YOU NEED?</label>
          <textarea id="requirements" required maxLength={4000} aria-describedby="requirements-hint" value={requirements} onChange={(event) => { setRequirements(event.target.value); updateDraft({ requirements: event.target.value }); if (error) setError(null); }} placeholder="Describe the project, expected outcome, important features, constraints and deadline." />
          <small id="requirements-hint">Explain the outcome you need. {requirements.length}/4000 characters.</small>
        </div>

        <div className={styles.grid2}>
          <div className={styles.field}>
            <label htmlFor="location">LOCATION · OPTIONAL</label>
            <input id="location" maxLength={300} value={location} onChange={(event) => { setLocation(event.target.value); updateDraft({ location: event.target.value }); }} placeholder="Lagos, Nigeria" />
          </div>
          <div className={styles.field}>
            <label htmlFor="notes">NOTES · OPTIONAL</label>
            <input id="notes" maxLength={2000} value={notes} onChange={(event) => { setNotes(event.target.value); updateDraft({ notes: event.target.value }); }} placeholder="Anything else the Hustler should know" />
          </div>
        </div>

        {error && <div className={styles.error} role="alert" id="booking-form-error">{error}</div>}
        <button className={styles.primary} type="submit" aria-busy={submitting} disabled={submitting || !requirements.trim()}>{submitting ? "Checking schedule…" : "Submit booking request →"}</button>
      </form>
    </div>
  </main>;
}
