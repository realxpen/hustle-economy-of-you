"use client";

import { useEffect, useState } from "react";
import { getAttributionPreference, setAttributionPreference, type AttributionPreference } from "../../lib/attribution-consent";
import styles from "./attribution-consent.module.css";

export function AttributionConsentSettings() {
  const [preference, setPreference] = useState<AttributionPreference | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    getAttributionPreference()
      .then(value => { if (current) setPreference(value); })
      .catch(reason => { if (current) setError(reason instanceof Error ? reason.message : "Could not load your privacy choice"); });
    return () => { current = false; };
  }, []);

  async function change() {
    if (!preference || busy) return;
    const desired = !preference.enabled;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await setAttributionPreference(desired);
      setPreference(updated);
      setNotice(desired
        ? "Enabled. Only future eligible clicks may be linked to your future transactions."
        : "Disabled. Your previous clicks will no longer appear in linked-outcome reports.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update this setting");
    } finally {
      setBusy(false);
    }
  }

  return <section className={styles.panel} aria-labelledby="attribution-privacy-title">
    <p className={styles.eyebrow}>PRIVACY / OPTIONAL ANALYTICS</p>
    <div className={styles.head}>
      <h2 id="attribution-privacy-title">Help improve Hustle discovery</h2>
      <span className={styles.state} role="status">
        {preference ? preference.enabled ? "Opted in" : "Off by default" : "Loading preference…"}
      </span>
    </div>
    <p className={styles.body}>With your permission, Hustle can count when you tap a Service or Product and later book or buy <strong>that same offer</strong>. Only aggregate results appear in the Admin dashboard. This does not affect recommendations, Booking, payment, or your account features.</p>
    <p className={styles.body}>Participation is optional. You can switch it off anytime; earlier clicks then stop contributing to linked-outcome reports. Turning it back on starts fresh.</p>
    <div className={styles.controls}>
      <button type="button" className={styles.button} disabled={!preference || busy} onClick={() => void change()}>
        {busy ? "Saving…" : preference?.enabled ? "Turn off attribution" : "Allow optional attribution"}
      </button>
    </div>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {notice && <p className={styles.notice} role="status">{notice}</p>}
    <p className={styles.detail}>Only your own future eligible offer clicks are considered, for up to seven days before your Booking or Order. No private messages, financial details, searches, or identity lists appear in the Admin report. Hustle's existing non-attribution event collection is separate from this choice.</p>
  </section>;
}
