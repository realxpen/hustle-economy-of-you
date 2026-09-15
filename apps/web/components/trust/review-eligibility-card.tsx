"use client";

import { useEffect, useState } from "react";
import {
  getReviewEligibility,
  revieweeLabel,
  type ReviewEligibility,
  type ReviewSubjectType
} from "../../lib/trust";
import styles from "./review-eligibility-card.module.css";

export function ReviewEligibilityCard({
  subjectType,
  subjectId
}: {
  subjectType: ReviewSubjectType;
  subjectId: string;
}) {
  const [eligibility, setEligibility] = useState<ReviewEligibility | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setEligibility(null);

    getReviewEligibility(subjectType, subjectId)
      .then((result) => {
        if (active) setEligibility(result);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : "Could not load review eligibility");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [subjectId, subjectType]);

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
      <strong>Review status unavailable</strong>
      <p>{error}</p>
    </div>}

    {eligibility && <>
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

      {eligibility.eligible && !eligibility.existingReview && <div className={styles.actionBlock}>
        <button type="button" className={styles.button} disabled>Leave a review</button>
        <small>Eligibility is live. Rating and written-review submission is enabled in Phase 14B.</small>
      </div>}
    </>}
  </section>;
}
