"use client";

import { useMemo, useState } from "react";

import { getCanonicalStorefrontUrl } from "../../lib/storefront-url";
import styles from "./storefront-distribution-dock.module.css";

export function StorefrontDistributionDock({ username }: { username: string }) {
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const normalizedUsername = username.replace(/^@/, "");
  const canonicalUrl = useMemo(() => getCanonicalStorefrontUrl(username), [username]);
  const shareText = `View @${normalizedUsername}'s Hustle storefront — The Economy of You.`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=360x360&margin=12&data=${encodeURIComponent(canonicalUrl)}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(canonicalUrl);
      setNotice("Canonical storefront link copied");
      window.setTimeout(() => setNotice(null), 2200);
    } catch {
      setNotice("Could not copy link");
    }
  }

  async function nativeShare() {
    if (!navigator.share) {
      await copyLink();
      return;
    }
    try {
      await navigator.share({
        title: `@${normalizedUsername} on Hustle`,
        text: shareText,
        url: canonicalUrl
      });
    } catch {
      // User cancellation is not an error state for the storefront.
    }
  }

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${shareText} ${canonicalUrl}`)}`;
  const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(canonicalUrl)}`;
  const emailUrl = `mailto:?subject=${encodeURIComponent(`@${normalizedUsername} on Hustle`)}&body=${encodeURIComponent(`${shareText}\n\n${canonicalUrl}`)}`;

  return <>
    <div className={styles.dock}>
      <button type="button" onClick={() => setOpen(true)}>Share storefront ↗</button>
    </div>

    {notice && <div className={styles.notice}>{notice}</div>}

    {open && <div className={styles.backdrop} role="presentation" onMouseDown={() => setOpen(false)}>
      <section className={styles.panel} role="dialog" aria-modal="true" aria-label="Share this Hustle storefront" onMouseDown={(event) => event.stopPropagation()}>
        <div className={styles.panelHeader}>
          <div>
            <p>DISTRIBUTE YOUR HUSTLE</p>
            <h2>One storefront. One public identity.</h2>
          </div>
          <button type="button" aria-label="Close share panel" onClick={() => setOpen(false)}>×</button>
        </div>

        <div className={styles.body}>
          <div className={styles.qrCard}>
            <img src={qrUrl} alt={`QR code for @${normalizedUsername}'s Hustle storefront`} />
            <small>SCAN TO OPEN</small>
            <strong>@{normalizedUsername}</strong>
          </div>

          <div className={styles.shareColumn}>
            <div className={styles.canonicalBox}>
              <small>CANONICAL STOREFRONT URL</small>
              <code>{canonicalUrl}</code>
            </div>
            <button type="button" className={styles.primary} onClick={() => void copyLink()}>Copy canonical link</button>
            <button type="button" onClick={() => void nativeShare()}>Share with device</button>
            <a href={whatsappUrl} target="_blank" rel="noreferrer">Share to WhatsApp</a>
            <a href={xUrl} target="_blank" rel="noreferrer">Share to X</a>
            <a href={emailUrl}>Share by email</a>
            <p className={styles.platformNote}>For Instagram and other installed apps, use <strong>Share with device</strong> where your browser supports native sharing.</p>
          </div>
        </div>
      </section>
    </div>}
  </>;
}
