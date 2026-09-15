"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createCounterpartyFeedback,
  getCounterpartyFeedbackEligibility,
  type CounterpartyFeedbackEligibility,
  type CounterpartyFeedbackIssue
} from "../../lib/trust-safety";
import type { ReviewSubjectType } from "../../lib/trust";
import styles from "./counterparty-feedback-card.module.css";

const issueOptions: Array<{ value: CounterpartyFeedbackIssue; label: string }> = [
  { value: "NO_SHOW", label: "No-show" },
  { value: "ABUSIVE_BEHAVIOR", label: "Abusive behaviour" },
  { value: "SCOPE_MANIPULATION", label: "Scope manipulation" },
  { value: "REPEATED_CANCELLATION", label: "Repeated cancellation" },
  { value: "FRAUD_SUSPICIOUS", label: "Fraud / suspicious behaviour" },
  { value: "DISPUTE_ABUSE", label: "Dispute abuse" },
  { value: "COMMUNICATION_PROBLEMS", label: "Communication problems" },
  { value: "PAYMENT_ABUSE", label: "Payment abuse" },
  { value: "OTHER", label: "Other" }
];

function targetLabel(eligibility: CounterpartyFeedbackEligibility) {
  return eligibility.target.displayName
    ?? (eligibility.target.username ? `@${eligibility.target.username}` : "this counterparty");
}

export function CounterpartyFeedbackCard({
  subjectType,
  subjectId
}: {
  subjectType: ReviewSubjectType;
  subjectId: string;
}) {
  const [eligibility, setEligibility] = useState<CounterpartyFeedbackEligibility | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [wouldWorkAgain, setWouldWorkAgain] = useState<boolean | null>(null);
  const [experienceRating, setExperienceRating] = useState<number | null>(null);
  const [issues, setIssues] = useState<CounterpartyFeedbackIssue[]>([]);
  const [privateNote, setPrivateNote] = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setEligibility(await getCounterpartyFeedbackEligibility(subjectType, subjectId));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load private feedback eligibility");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [subjectType, subjectId]);

  const providerSide = eligibility?.author.role === "HUSTLER" || eligibility?.author.role === "SELLER";

  const canSubmit = useMemo(() => {
    return Boolean(
      eligibility?.eligible
      && wouldWorkAgain !== null
      && !submitting
      && privateNote.length <= 2000
    );
  }, [eligibility?.eligible, privateNote.length, submitting, wouldWorkAgain]);

  function toggleIssue(issue: CounterpartyFeedbackIssue) {
    setIssues((current) => current.includes(issue)
      ? current.filter((item) => item !== issue)
      : [...current, issue]);
  }

  async function submit() {
    if (!eligibility?.eligible || wouldWorkAgain === null) return;
    setSubmitting(true);
    setError(null);
    try {
      await createCounterpartyFeedback({
        subjectType,
        subjectId,
        wouldWorkAgain,
        ...(experienceRating ? { experienceRating } : {}),
        issueCategories: issues,
        ...(privateNote.trim() ? { privateNote: privateNote.trim() } : {})
      });
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not submit private feedback");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <section className={styles.card} aria-live="polite">
      <small className={styles.eyebrow}>PRIVATE · TRUST & SAFETY</small>
      <p className={styles.muted}>Checking counterparty feedback…</p>
    </section>;
  }

  if (!eligibility && error) {
    return <section className={styles.card} aria-live="polite">
      <small className={styles.eyebrow}>PRIVATE · TRUST & SAFETY</small>
      <div className={styles.error}><strong>Feedback status unavailable</strong><p>{error}</p></div>
    </section>;
  }

  if (!eligibility || !providerSide || eligibility.reasonCode === "FEEDBACK_ROLE_NOT_ELIGIBLE") return null;

  const target = targetLabel(eligibility);

  return <section className={styles.card} aria-live="polite">
    <div className={styles.heading}>
      <div>
        <small className={styles.eyebrow}>PRIVATE · TRUST & SAFETY</small>
        <h2>How was {target}?</h2>
      </div>
      <span className={styles.privateBadge}>Private feedback</span>
    </div>

    <p className={styles.privacyNote}>
      This is private operational feedback for Hustle Trust & Safety. It is not a public review and does not change the Client or Buyer&apos;s public profile.
    </p>

    {eligibility.existingFeedback ? <div className={styles.success}>
      <strong>Private feedback submitted</strong>
      <p>Hustle recorded your transaction-backed feedback on {new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(new Date(eligibility.existingFeedback.createdAt))}.</p>
    </div> : !eligibility.eligible ? <div className={styles.locked}>
      <strong>Feedback locked</strong>
      <p>{eligibility.message}</p>
      <span className={styles.state}>{eligibility.transactionStatus.replaceAll("_", " ")}</span>
    </div> : <>
      <div className={styles.questionBlock}>
        <strong>Would you work with {target} again?</strong>
        <div className={styles.choiceRow}>
          <button type="button" className={wouldWorkAgain === true ? styles.choiceActive : styles.choice} onClick={() => setWouldWorkAgain(true)}>Yes</button>
          <button type="button" className={wouldWorkAgain === false ? styles.choiceActive : styles.choice} onClick={() => setWouldWorkAgain(false)}>No</button>
        </div>
      </div>

      <div className={styles.questionBlock}>
        <strong>Experience rating <span>optional</span></strong>
        <div className={styles.ratingRow} aria-label="Private experience rating">
          {[1, 2, 3, 4, 5].map((rating) => <button
            type="button"
            key={rating}
            aria-label={`${rating} star${rating === 1 ? "" : "s"}`}
            className={experienceRating === rating ? styles.starActive : styles.star}
            onClick={() => setExperienceRating(experienceRating === rating ? null : rating)}
          >★</button>)}
        </div>
      </div>

      <div className={styles.questionBlock}>
        <strong>Anything Hustle should know? <span>optional</span></strong>
        <div className={styles.issueGrid}>
          {issueOptions.map((issue) => <label key={issue.value} className={issues.includes(issue.value) ? styles.issueActive : styles.issue}>
            <input type="checkbox" checked={issues.includes(issue.value)} onChange={() => toggleIssue(issue.value)} />
            <span>{issue.label}</span>
          </label>)}
        </div>
      </div>

      <div className={styles.questionBlock}>
        <label htmlFor={`private-feedback-${subjectType}-${subjectId}`}><strong>Private note <span>optional</span></strong></label>
        <textarea
          id={`private-feedback-${subjectType}-${subjectId}`}
          value={privateNote}
          maxLength={2000}
          onChange={(event) => setPrivateNote(event.target.value)}
          placeholder="Add context that can help Hustle Trust & Safety understand the experience."
        />
        <small className={styles.counter}>{privateNote.length}/2000</small>
      </div>

      {error && <div className={styles.error}><strong>Could not submit feedback</strong><p>{error}</p></div>}

      <button type="button" className={styles.submit} disabled={!canSubmit} onClick={() => void submit()}>
        {submitting ? "Submitting…" : "Submit private feedback"}
      </button>
    </>}
  </section>;
}
