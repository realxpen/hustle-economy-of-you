"use client";

import type { ReviewRecord } from "../../lib/trust";
import styles from "./reputation-surfaces.module.css";

function displayName(review: ReviewRecord, perspective: "received" | "given") {
  const user = perspective === "received" ? review.reviewer : review.reviewee;
  return user.displayName ?? (user.username ? `@${user.username}` : "Hustle user");
}

function context(review: ReviewRecord) {
  if (!review.context) return { label: "Verified Hustle transaction", href: null as string | null };

  if (review.context.kind === "SERVICE") {
    return {
      label: review.context.title,
      href: `/services/${encodeURIComponent(review.context.serviceId)}`
    };
  }

  const first = review.context.items[0];
  const extra = Math.max(0, review.context.items.length - 1);
  return {
    label: first
      ? `${first.title}${first.variantName ? ` · ${first.variantName}` : ""}${extra ? ` +${extra} more` : ""}`
      : "Product order",
    href: first ? `/products/${encodeURIComponent(first.productId)}` : null
  };
}

export function ReviewCard({
  review,
  perspective = "received"
}: {
  review: ReviewRecord;
  perspective?: "received" | "given";
}) {
  const transactionContext = context(review);
  const stars = `${"★".repeat(review.rating)}${"☆".repeat(Math.max(0, 5 - review.rating))}`;
  const date = new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(review.createdAt));

  return <article className={styles.reviewCard}>
    <div className={styles.reviewTop}>
      <div className={styles.person}>
        <strong>{perspective === "received" ? `From ${displayName(review, perspective)}` : `For ${displayName(review, perspective)}`}</strong>
        <span>{review.reviewerRole} → {review.revieweeRole}</span>
      </div>
      <span className={styles.stars} aria-label={`${review.rating} out of 5 stars`}>{stars}</span>
    </div>

    <p className={styles.reviewBody}>{review.body}</p>

    <div className={styles.contextBox}>
      <span className={styles.contextLabel}>{review.context?.kind === "SERVICE" ? "SERVICE" : review.context?.kind === "PRODUCT_ORDER" ? "PRODUCT" : "TRANSACTION"}</span>
      {transactionContext.href
        ? <a href={transactionContext.href}>{transactionContext.label} →</a>
        : <strong>{transactionContext.label}</strong>}
    </div>

    <div className={styles.reviewBottom}>
      {review.verifiedTransaction && <span className={styles.reviewVerified}>✓ Verified transaction</span>}
      <span>Published {date}</span>
    </div>
  </article>;
}
