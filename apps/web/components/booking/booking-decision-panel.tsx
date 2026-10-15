"use client";

import { FormEvent } from "react";
import styles from "../../app/bookings/bookings.module.css";

export type BookingDecision = "DECLINE" | "CANCEL";

/**
 * A browser prompt is not confirmation: dismissing window.prompt() returns
 * null and must NEVER silently authorize a booking state transition.
 */
export function BookingDecisionPanel({
  decision, reason, onReasonChange, onDismiss, onConfirm, busy
}: {
  decision: BookingDecision;
  reason: string;
  onReasonChange: (reason: string) => void;
  onDismiss: () => void;
  onConfirm: () => void;
  busy: boolean;
}) {
  const declining = decision === "DECLINE";
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!busy) onConfirm();
  }

  return <form className={styles.decisionPanel} onSubmit={submit} aria-label={declining ? "Decline request confirmation" : "Cancel booking confirmation"}>
    <strong>{declining ? "Decline this request?" : "Cancel this booking?"}</strong>
    <p>{declining
      ? "The Client will see this request as declined. This action cannot be undone."
      : "The other participant will see this Booking as cancelled. This action cannot be undone."}</p>
    <label htmlFor="booking-decision-reason">Reason (optional)</label>
    <textarea id="booking-decision-reason" maxLength={1000} value={reason} disabled={busy}
      onChange={(event) => onReasonChange(event.target.value)}
      placeholder="Share a short explanation for the other participant" />
    <small>{reason.length}/1000 characters</small>
    <div className={styles.decisionButtons}>
      <button type="submit" disabled={busy} className={styles.danger}>
        {busy ? "Processing…" : declining ? "Confirm decline" : "Confirm cancellation"}
      </button>
      <button type="button" disabled={busy} onClick={onDismiss} className={styles.secondary}>Keep booking</button>
    </div>
  </form>;
}
