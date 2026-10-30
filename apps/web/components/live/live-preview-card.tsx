"use client";

import Link from "next/link";
import { useState } from "react";
import type { LiveSessionRecord } from "../../lib/live";
import { formatLiveMoney } from "../../lib/live";
import styles from "./live-preview-card.module.css";

function previewMediaUrl(session: LiveSessionRecord) {
  // Do not pretend a LiveKit stream is a regular URL. Only explicitly published,
  // directly browser-playable media can provide a silent public preview.
  const candidate = session.media?.playbackUrl ?? session.playbackUrl;
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:") return null;
    if (!/\.(?:mp4|webm|m3u8)(?:$|[?#])/i.test(url.pathname + url.search)) return null;
    return url.href;
  } catch { return null; }
}

export function LivePreviewCard({ session, context = "live" }: {
  session: LiveSessionRecord;
  context?: "live" | "discovery";
}) {
  const [videoFailed, setVideoFailed] = useState(false);
  const isBroadcasting = session.status === "LIVE";
  const mediaUrl = previewMediaUrl(session);
  const poster = session.host.avatarUrl;
  const offer = session.pinnedProduct ?? session.pinnedService;
  const offerType = session.pinnedProduct ? "PRODUCT" : session.pinnedService ? "SERVICE" : null;
  const name = session.host.displayName?.trim() || session.host.username || "Hustle creator";

  return <Link className={styles.card} data-live-preview={context} href={`/live/${encodeURIComponent(session.id)}`}
    aria-label={`Enter Live: ${session.title} by ${name}`}>
    <div className={styles.stage} aria-hidden="true">
      {poster && <img className={styles.poster} src={poster} alt="" loading="lazy" />}
      {isBroadcasting && mediaUrl && !videoFailed &&
        <video className={styles.video} src={mediaUrl} muted autoPlay playsInline loop preload="metadata"
          poster={poster ?? undefined} onError={() => setVideoFailed(true)} />}
      <div className={styles.stageTint} />
      {!mediaUrl && <span className={styles.posterMark}>✳</span>}
    </div>
    <div className={styles.header}>
      <span className={styles.liveBadge}><span aria-hidden="true" /> LIVE</span>
      <span className={styles.viewerCount}>{session.interactions.viewers} watching</span>
    </div>
    <div className={styles.footer}>
      <div className={styles.host}>
        <span className={styles.avatar}>
          {poster ? <img src={poster} alt="" loading="lazy" /> : name.slice(0,1).toUpperCase()}
        </span>
        <div><strong>{name}</strong>
          <small>{session.host.username ? `@${session.host.username}` : session.category ?? "Hustle LIVE"}</small>
        </div>
      </div>
      <h2>{session.title}</h2>
      {offer && offerType && <div className={styles.pinned} aria-label={`Attached ${offerType.toLowerCase()}: ${offer.title ?? "Offer"}`}>
        <span className={styles.pinnedSymbol} aria-hidden="true">{offerType === "PRODUCT" ? "◇" : "✦"}</span>
        <span className={styles.pinnedCopy}>
          <strong>{offer.title ?? "Attached offer"}</strong>
          <small>{formatLiveMoney(offer.priceMinor, offer.currency)} · {offerType === "PRODUCT" ? "Product" : "Service"}</small>
        </span>
        <span className={styles.pinnedAction}>View ↗</span>
      </div>}
      <span className={styles.enter}>Tap to enter the Live <span aria-hidden="true">↗</span></span>
    </div>
  </Link>;
}
