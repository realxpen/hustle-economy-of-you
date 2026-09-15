"use client";

import { useEffect, useState } from "react";
import {
  createReview,
  getReview,
  getReviewEligibility,
  revieweeLabel,
  type ReviewEligibility,
  type ReviewRecord,
  type ReviewSubjectType
} from "../../lib/trust";
import styles from "./review-eligibility-card.module.css";

function StarRating({
  value,
  disabled,
  onChange
}: {
  value: number;
  disabled?: boolean;
  onChange: (rating: number) => void;
}) {
  return <div className={styles.stars} role="radiogroup" aria-label="Overall rating">
    {[1, 2, 3, 4, 5].map((rating) => <button
      key={rating}
      type="button"
      role="radio"
      aria-checked={value === rating}
      aria-label={`${rating} star${rating === 1 ? "" : "s"}`}
      disabled={disabled}
      className={rating <= value ? styles.starActive : styles.star}
      onClick={() => onChange(rating)}
    >★</button>)}
  </div>;
}

function PublishedReview({ review }: { review: ReviewRecord }) {
  return <div className={styles.published}>
    <div className={styles.publishedHeading}>
      <strong>Review submitted</strong>
      <span>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</span>
    </div>
    <p>{review.body}</p>
    <small>Verified transaction · Published {new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(new Date(review.createdAt))}</small>
  </div>;
}

export function ReviewEligibilityCard({
  subjectType,
  subjectId
}: {
  subjectType: ReviewSubjectType;
  subjectId: string;
}) {
  const [eligibility, setEligibility] = useState<ReviewEligibility | null>(null);
  const [review, setReview] = useState<ReviewRecord | null>(null);
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);
      setEligibility(null);
      setReview(null);
      try {
        const result = await getReviewEligibility(subjectType, subjectId);
        if (!active) return;
        setEligibility(result);
        if (result.existingReview) {
          const existing = await getReview(result.existingReview.id);
          if (active) setReview(existing);
        }
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Could not load review eligibility");
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => { active = false; };
  }, [subjectId, subjectType]);

  async function submitReview() {
    if (!eligibility?.eligible || submitting) return;
    if (rating < 1 || rating > 5) {
      setError("Choose a rating from 1 to 5 stars.");
      return;
    }
    const normalized = body.trim();
    if (normalized.length < 10 || normalized.length > 2000) {
      setError("Write a review between 10 and 2000 characters.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const result = await createReview({ subjectType, subjectId, rating, body: normalized });
      setReview(result.review);
      setEligibility({
        ...eligibility,
        eligible: false,
        reasonCode: "ALREADY_REVIEWED",
        message: "You have already reviewed this transaction.",
        verifiedTransaction: true,
        existingReview: {
          id: result.review.id,
          status: result.review.status,
          verifiedTransaction: result.review.verifiedTransaction,
          createdAt: result.review.createdAt
        }
      });
      setBody("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not submit review");
    } finally {
      setSubmitting(false);
    }
  }

  // Phase 14 public reputation is demand-side -> provider only. Provider-side
  // callers may query eligibility for an authoritative answer, but they do not
  // receive a public review surface in the product experience.
  if (!loading && !error && eligibility?.reasonCode === "REVIEWER_ROLE_NOT_ELIGIBLE") {
    return null;
  }

  return <section className={styles.card} aria-live="polite">
    <div className={styles.heading}>
      <div>
        <small>TRUST · REVIEW</small>
        <h2>Transaction review</h2>
      </div>
      {eligibility?.verifiedTransaction && <span className={styles.verified}>✓ Verified transaction</span>}
    </div>

    {loading && <p className={styles.muted}>Checking review eligibility…</p>}

    {error && <div className={styles.error}>
      <strong>Review action needs attention</strong>
      <p>{error}</p>
    </div>}

    {review && <PublishedReview review={review} />}

    {eligibility && !review && <>
      {eligibility.existingReview ? <div className={styles.success}>
        <strong>Review submitted</strong>
        <p>Your verified review is already attached to this transaction.</p>
      </div> : eligibility.eligible ? <div className={styles.success}>
        <strong>Review unlocked</strong>
        <p>You can review {revieweeLabel(eligibility)} because this transaction has verified completion evidence.</p>
      </div> : <div className={styles.locked}>
        <strong>Review locked</strong>
        <p>{eligibility.message}</p>
      </div>}

      <div className={styles.meta}>
        <span>{eligibility.reviewer.role} → {eligibility.reviewee.role}</span>
        <span>{eligibility.reasonCode.replaceAll("_", " ")}</span>
      </div>

      {eligibility.eligible && !eligibility.existingReview && <div className={styles.reviewForm}>
        <label>
          <span>OVERALL RATING</span>
          <StarRating value={rating} disabled={submitting} onChange={setRating} />
        </label>
        <label>
          <span>YOUR REVIEW</span>
          <textarea
            value={body}
            disabled={submitting}
            maxLength={2000}
            rows={5}
            placeholder={`Tell others what it was like working with ${revieweeLabel(eligibility)}.`}
            onChange={(event) => setBody(event.target.value)}
          />
        </label>
        <div className={styles.formFooter}>
          <small>{body.trim().length}/2000 · minimum 10 characters</small>
          <button
            type="button"
            className={styles.button}
            disabled={submitting || rating < 1 || body.trim().length < 10}
            onClick={() => void submitReview()}
          >{submitting ? "Publishing…" : "Publish verified review"}</button>
        </div>
        <small className={styles.muted}>Published reviews are immutable in the MVP. Hustle re-checks transaction eligibility when you submit.</small>
      </div>}
    </>}
  </section>;
}
