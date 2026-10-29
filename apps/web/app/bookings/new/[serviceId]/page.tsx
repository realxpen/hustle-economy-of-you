"use client";

import { FormEvent, useEffect, useState } from "react";
import { ExperienceHeader } from "../../../../components/navigation/experience-header";
import { ExperienceState } from "../../../../components/experience/experience-state";
import { useParams, useRouter } from "next/navigation";
import { OpportunityContext } from "../../../../components/commerce/opportunity-context";
import { useSourcePost, withSourcePost } from "../../../../lib/opportunity-source";
import { withTransactionReturnTo } from "../../../../lib/transaction-return";
import { checkBookingAvailability, createBooking, listFlowTimeSlots, type FlowTimeSlotDay, type BookingAvailability } from "../../../../lib/booking";
import { openDirectConversation } from "../../../../lib/messaging";
import { shouldContinueBookingWithoutConversation } from "../../../../lib/booking-consultation-policy";
import { authUrlFor } from "../../../../lib/auth/safe-auth-next";
import { hasViewerSession } from "../../../../lib/api/public-browsing";
import { isolatedWebMode } from "../../../../lib/auth/isolated-web-auth";
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

function toLocalInput(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
function serviceToday(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date());
  const read = (key: string) => parts.find((part)=>part.type===key)?.value ?? "";
  return read("year") + "-" + read("month") + "-" + read("day");
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
  const [slotDate, setSlotDate] = useState("");
  const [slotDay, setSlotDay] = useState<FlowTimeSlotDay | null>(null);
  const [slotError, setSlotError] = useState<string | null>(null);
  const [checkingSlots, setCheckingSlots] = useState(false);
  const [checkedTime, setCheckedTime] = useState<BookingAvailability | null>(null);
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
        setSlotDate(serviceToday(service.service.bookingTimezone));
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

  useEffect(() => {
    if (!data || !slotDate || data.service.bookingMode !== "APPOINTMENT") {
      setSlotDay(null); return;
    }
    let active = true;
    setSlotDay(null);
    setSlotError(null);
    setCheckingSlots(true);
    void listFlowTimeSlots(data.service.id, slotDate).then((response) => {
      if (active) setSlotDay(response);
    }).catch((reason: Error) => {
      if (active) setSlotError(reason.message);
    }).finally(()=>{ if(active) setCheckingSlots(false); });
    return () => { active = false; };
  }, [data, slotDate]);

  useEffect(() => {
    if (!data || !requestedStartAt) { setCheckedTime(null); return; }
    const start = toIso(requestedStartAt);
    const end = toIso(requestedEndAt);
    if (!start || (requestedEndAt && !end)) { setCheckedTime(null); return; }
    let active=true;
    void checkBookingAvailability({serviceId:data.service.id,startAt:start,...(end?{endAt:end}:{})})
      .then((result)=>{if(active)setCheckedTime(result);})
      .catch(()=>{if(active)setCheckedTime(null);});
    return ()=>{active=false;};
  }, [data, requestedStartAt, requestedEndAt]);

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
      if (!await hasViewerSession()) {
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

      // A direct thread helps coordination, but its ID is optional for ordinary
      // Bookings. Only temporary Messaging gateway failure may degrade.
      let conversationId: string | undefined;
      try {
        const direct = await openDirectConversation(data.owner.id);
        conversationId = direct.conversation.id;
      } catch (conversationError) {
        if (!shouldContinueBookingWithoutConversation(data.service.bookingMode, conversationError)) {
          throw conversationError;
        }
      }
      const booking = await createBooking({
        serviceId: data.service.id,
        requestedStartAt: start,
        ...(end ? { requestedEndAt: end } : {}),
        requirements,
        ...(location.trim() ? { location: location.trim() } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        ...(conversationId ? { conversationId } : {})
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
    {service.bookingMode === "CONSULTATION" && <section className={styles.consultationRequired} aria-label="Consultation before booking">
      <strong>{isolatedWebMode ? "Consultation required before booking" : "Consult with the Hustler before booking"}</strong>
      <p>{isolatedWebMode
        ? "Send a message about this Service using the linked Service in the conversation. Then return here to submit your request. Opening a chat without sending a Service-linked message is not enough."
        : "Discuss the Service requirements with this Hustler first. Use the linked Service in your message, then come back to finish your Booking request."}</p>
      <a href={consultHref}>Message about this service ↗</a>
      <small>Your prepared Booking draft stays in this browser tab. No payment or booking is created by messaging.</small>
    </section>}
    <div className={styles.formWrap}>
      <section className={styles.formHero}>
        <article className={styles.offerCard}>
          <p className={styles.eyebrow}>BOOK SERVICE</p>
          <h1>{service.title}</h1>
          <p className={styles.price}>{formatServicePrice(service)}</p>
          <p>By {owner.displayName ?? `@${owner.username}`} · {service.deliveryMode}</p>
          <p>{isolatedWebMode ? "Isolated staging scheduling only: no payment, deposit or work is initiated by this request. Hustler approval is still required." : "This request preserves the Service, price basis and schedule as transaction history. You will review payment only if the Hustler accepts a paid Booking; submitting this request does not charge you."}</p>
        </article>
        <aside className={styles.offerCard}>
          <p className={styles.eyebrow}>HOW IT WORKS</p>
          <p>1. Pick a time or propose a deadline. FlowTime considers work duration, operating hours and capacity.</p>
          <p>2. Describe what you need.</p>
          <p>3. The Hustler accepts, adjusts the confirmed time, or declines.</p>
          <p>{isolatedWebMode ? "4. Booking requests and scheduling decisions are test-only; all payment and work completion actions remain disabled." : "4. Any paid Booking stays payment pending until the payment provider confirms funding."}</p>
        </aside>
      </section>

      <form className={styles.formCard} onSubmit={submit} aria-busy={submitting} aria-describedby="booking-form-help">
        <div className={styles.formLead}>
          <span className={styles.formStep}>Your request · Step 1 of 2</span>
          <h2>Plan the booking</h2>
          <p>Choose a time that works for you, then share the job details.</p>
        </div>
        <p id="booking-form-help" className="h-ui-subtitle">Only the requested start and project description are required. We check availability before sending the request. If you need to sign in, your draft will still be here when you return.</p>
        <div className={styles.draftStatus} role="status">
          <span>{draftRestored
            ? "Draft restored — finish your request when ready."
            : draftPresent
              ? "Draft saved in this tab. Nothing has been sent or charged."
              : "Your draft is stored only in this browser tab for up to 2 hours as you type."}</span>
          {draftPresent && <button type="button" onClick={discardDraft} disabled={submitting}>Clear draft</button>}
        </div>
        <div className={styles.formSectionHeading}>
          <span className={styles.formStep}>01 · Timing</span>
          <h3>When do you need this?</h3>
        </div>
        <section className={styles.flowTimeSlots} aria-label="FlowTime availability">
          <div className={styles.flowTimeHead}><div><strong>Available booking times</strong><p>
            {service.bookingMode === "APPOINTMENT"
              ? "Live remaining capacity. A requested appointment is not held until the Hustler accepts."
              : service.bookingMode === "WORK_QUEUE"
                ? "This service accepts concurrent work orders. A start date is a proposal, not a reserved appointment."
                : "Consult with the Hustler before confirming a schedule."}
          </p></div><span>{service.bookingTimezone}</span></div>
          {service.bookingMode === "APPOINTMENT" && <>
            <label className={styles.flowTimeDate}>Find a date <input aria-label="Availability date" type="date" value={slotDate} onChange={(e)=>setSlotDate(e.target.value)}/></label>
            {checkingSlots && <p role="status">Checking live appointment capacity…</p>}
            {slotError && <p role="alert">{slotError}</p>}
            {slotDay && <>
              {!slotDay.configuredHours && <p>Indicative 9 AM–6 PM slots: this Hustler has not set structured operating hours. Confirm the time before travelling.</p>}
              <div className={styles.flowTimeGrid}>
                {slotDay.slots.map((slot)=><button type="button" key={slot.startAt}
                  disabled={!slot.available || submitting}
                  aria-label={new Intl.DateTimeFormat("en-NG",{hour:"numeric",minute:"2-digit",timeZone:service.bookingTimezone}).format(new Date(slot.startAt))+"; "+(slot.available?slot.remainingCapacity+" places available":"fully booked")}
                  onClick={()=>{
                    const start=toLocalInput(slot.startAt);
                    const end=slot.endAt ? toLocalInput(slot.endAt) : "";
                    setRequestedStartAt(start); setRequestedEndAt(end);
                    updateDraft({requestedStartAt:start, requestedEndAt:end});
                    setError(null);
                  }}>
                  <strong>{new Intl.DateTimeFormat("en-NG",{hour:"numeric",minute:"2-digit",timeZone:service.bookingTimezone}).format(new Date(slot.startAt))}</strong>
                  <small>{slot.available ? slot.overbooking ? "Limited extra place" : slot.remainingCapacity+" available" : "Fully booked"}</small>
                </button>)}
              </div>
              {slotDay.slots.length === 0 && <p>No start times remain for this day. Try another date.</p>}
            </>}
          </>}
          {service.bookingMode !== "APPOINTMENT" && <p>Typical turnaround: {service.turnaroundHours} hours, subject to Hustler confirmation.</p>}
        </section>
        <div className={styles.grid2}>
          <div className={styles.field}>
            <label htmlFor="start">REQUESTED START</label>
            <input id="start" type="datetime-local" required aria-invalid={Boolean(error && error.includes("start"))} value={requestedStartAt} onChange={(event) => { setRequestedStartAt(event.target.value); setSlotDate(event.target.value.slice(0,10)); updateDraft({ requestedStartAt: event.target.value }); if (error) setError(null); }} />
          </div>
          <div className={styles.field}>
            <label htmlFor="end">REQUESTED END · OPTIONAL</label>
            <input id="end" type="datetime-local" aria-invalid={Boolean(error && error.includes("end"))} value={requestedEndAt} onChange={(event) => { setRequestedEndAt(event.target.value); updateDraft({ requestedEndAt: event.target.value }); if (error) setError(null); }} />
          </div>
        </div>

        {checkedTime && <p className={checkedTime.available ? styles.flowTimeAvailable : styles.flowTimeUnavailable} role="status">
          {checkedTime.available
            ? checkedTime.mode === "APPOINTMENT"
              ? checkedTime.overbooking ? "This is an extra-capacity slot; the Hustler must confirm timing." : checkedTime.remainingCapacity+" capacity remaining for the requested time."
              : "Request can be sent for Hustler review. No appointment is reserved."
            : checkedTime.reason ?? "Not available. Choose another time."}
        </p>}
        <div className={styles.formSectionHeading}>
          <span className={styles.formStep}>02 · Details</span>
          <h3>Tell them about the job</h3>
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

        <div className={styles.bookingRequestNotice}>
          <strong>Ready to request?</strong>
          <span>The Hustler reviews your time and requirements before accepting. This request does not make a payment.</span>
        </div>
        {error && <div className={styles.error} role="alert" id="booking-form-error">
          {error}
          {/consult this hustler|discuss this service in messages first/i.test(error) && <a className={styles.consultationRecovery} href={consultHref}>Open the required Service consultation ↗</a>}
        </div>}
        <button className={styles.primary} type="submit" aria-busy={submitting} disabled={submitting || !requirements.trim()}>{submitting ? "Checking schedule…" : isolatedWebMode && service.bookingMode === "CONSULTATION" ? "Request after consultation (test) →" : isolatedWebMode ? "Send test scheduling request →" : "Submit booking request →"}</button>
      </form>
    </div>
  </main>;
}
