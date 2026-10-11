"use client";

import Link from "next/link";
import styles from "./opportunity-context.module.css";

/** Compact continuity navigation; every enabled destination uses a real route.
 * It does not claim the supplied post is verified proof of the loaded offer. */
export function OpportunityContext({
  sourcePostId, ownerUsername, offerHref, offerLabel
}: {
  sourcePostId: string | null;
  ownerUsername?: string | null;
  offerHref?: string;
  offerLabel?: string;
}) {
  if (!sourcePostId && !ownerUsername && !offerHref) return null;
  return <nav className={styles.bar} aria-label="Explore this opportunity">
    <span className={styles.eyebrow}>EXPLORE THIS OPPORTUNITY</span>
    {sourcePostId && <Link href={`/posts/${encodeURIComponent(sourcePostId)}`}>← Return to post</Link>}
    {ownerUsername && <Link href={`/u/${encodeURIComponent(ownerUsername)}`}>Meet the Hustler ↗</Link>}
    {offerHref && <Link href={offerHref}>{offerLabel ?? "Review offer"} ↗</Link>}
  </nav>;
}
