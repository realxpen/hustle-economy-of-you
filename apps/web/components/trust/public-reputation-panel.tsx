"use client";

import type { PublicTrustSummary } from "../../lib/trust";
import { ReviewCard } from "./review-card";
import styles from "./reputation-surfaces.module.css";

export function PublicReputationPanel({ summary }: { summary: PublicTrustSummary }) {
  const { reputation, reviews, trust } = summary;
  const average = reputation.averageRating === null ? "—" : reputation.averageRating.toFixed(1);

  return <section className={styles.section}>
    <div className={styles.sectionHeader}>
      <div>
        <small>TRUST · VERIFIED OUTCOMES</small>
        <h2>Reputation</h2>
      </div>
      {trust.hasVerifiedReviews && <span className={styles.verifiedMarker}>✓ Verified reviews</span>}
    </div>

    <div className={styles.metrics}>
      <div className={styles.metric}>
        <strong>{average}</strong>
        <span>Average rating</span>
      </div>
      <div className={styles.metric}>
        <strong>{reputation.verifiedReviewCount}</strong>
        <span>Verified reviews</span>
      </div>
      <div className={styles.metric}>
        <strong>{reputation.bookingReviewCount}</strong>
        <span>Service reviews</span>
      </div>
      <div className={styles.metric}>
        <strong>{reputation.orderReviewCount}</strong>
        <span>Product reviews</span>
      </div>
    </div>

    {reviews.items.length > 0
      ? <div className={styles.reviewList}>
          {reviews.items.map((review) => <ReviewCard key={review.id} review={review} />)}
        </div>
      : <div className={styles.empty}>
          No verified transaction reviews yet. Reputation appears here only after completed Hustle transactions.
        </div>}

    {reviews.hasMore && <p className={styles.moreNote}>Showing the latest verified reviews.</p>}
  </section>;
}
