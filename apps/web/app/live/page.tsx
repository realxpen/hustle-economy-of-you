"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExperienceState } from "../../components/experience/experience-state";
import { LivePreviewCard } from "../../components/live/live-preview-card";
import { getActiveLiveSessions, type LiveSessionRecord } from "../../lib/live";
import styles from "./live.module.css";

/** LIVE is a Discovery feed filtered to active broadcasts. Open a card for
 * comments, video interaction and the full attached-offer experience. */
export default function LiveDiscoveryPage() {
  const [items, setItems] = useState<LiveSessionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    getActiveLiveSessions(30)
      .then((sessions) => { if (active) setItems(sessions.filter(s=>s.status === "LIVE")); })
      .catch((reason: Error) => { if (active) setError(reason.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reload]);

  return <main className={styles.livePreviewPage} data-hustle-live-previews="true">
    <header className={styles.livePreviewHeader}>
      <Link href="/home" aria-label="Return to Discover">‹ Discover</Link>
      <strong><span aria-hidden="true">●</span> LIVE</strong>
      <Link href="/live/create">Go Live ↗</Link>
    </header>
    <div className={styles.livePreviewIntro}>
      <strong>Hustlers live now</strong>
      <span>Tap a preview to join the full Live.</span>
    </div>
    {loading && <ExperienceState compact kind="loading" title="Finding live broadcasts…" />}
    {error && <ExperienceState compact kind="error" title="LIVE isn't available right now" description={error}
       action={{label:"Try again",onClick:()=>setReload(n=>n+1)}} />}
    {!loading && !error && items.length===0 && <div className={styles.livePreviewEmpty}>
      <span aria-hidden="true">✳</span>
      <h1>No one is live right now.</h1>
      <p>When a Hustler starts a Live, a preview appears here and can also be discovered in regular feeds.</p>
      <Link href="/home">Explore posts instead ↗</Link>
    </div>}
    {!loading && !error && items.length>0 && <section className={styles.livePreviewFeed}
      aria-label="Active Hustle LIVE previews; select a preview to enter the live room">
      {items.map(item => <div key={item.id} className={styles.livePreviewFrame}>
        <LivePreviewCard session={item} />
      </div>)}
    </section>}
  </main>;
}
