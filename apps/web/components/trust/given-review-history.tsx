"use client";

import { useEffect, useState } from "react";

import { listGivenReviews, type ReviewRecord } from "../../lib/trust";
import { ReviewCard } from "./review-card";
import styles from "./reputation-surfaces.module.css";

export function GivenReviewHistory() {
  const [items, setItems] = useState<ReviewRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    listGivenReviews(12)
      .then((result) => {
        if (!active) return;
        setItems(result.items.filter((review) => review.status === "PUBLISHED"));
        setHasMore(result.hasMore);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : "Could not load your reviews");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return <section className={`${styles.section} ${styles.historyShell}`}>
    <div className={styles.sectionHeader}>
      <div>
        <small>YOUR TRUST HISTORY</small>
        <h2>Reviews you’ve given</h2>
      </div>
    </div>

    {loading && <div className={styles.loading}>Loading verified reviews…</div>}
    {error && <div className={styles.error}>{error}</div>}
    {!loading && !error && items.length === 0 && <div className={styles.empty}>
      You have not published a verified transaction review yet.
    </div>}
    {!loading && !error && items.length > 0 && <div className={styles.reviewList}>
      {items.map((review) => <ReviewCard key={review.id} review={review} perspective="given" />)}
    </div>}
    {hasMore && <p className={styles.moreNote}>Showing your latest 12 published reviews.</p>}
  </section>;
}
