"use client";

import { useEffect, useState } from "react";

import { formatLiveMoney, getActiveLiveSessions, type LiveSessionRecord } from "../../lib/live";
import styles from "./live.module.css";

export default function LiveDiscoveryPage() {
  const [items, setItems] = useState<LiveSessionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getActiveLiveSessions(30)
      .then((sessions) => { if (active) setItems(sessions); })
      .catch((reason: Error) => { if (active) setError(reason.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return <main className={styles.page}>
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <a className={styles.brand} href="/home">HUSTLE</a>
        <div className={styles.actions}>
          <a href="/home">Home</a>
          <a className={styles.primary} href="/live/create">Start a Live</a>
        </div>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroPanel}>
          <div className={styles.eyebrow}>LIVE COMMERCE · PHASE 17</div>
          <h1>Watch the work. <em>Act while it is live.</em></h1>
          <p>Hustle Live connects demonstration directly to a real Service or Product. Watch, ask questions, visit the host, then move into the same canonical booking and buying flows already trusted elsewhere on Hustle.</p>
        </div>
        <aside className={styles.statusCard}>
          <div><div className={styles.eyebrow}>ACTIVE NOW</div><strong>{items.length}</strong></div>
          <span className={styles.liveDot}>{items.length === 1 ? "1 session live" : `${items.length} sessions live`}</span>
        </aside>
      </section>

      {loading && <section className={styles.empty}>Finding active Live sessions…</section>}
      {error && <section className={styles.error}>{error}</section>}

      {!loading && !error && items.length === 0 && <section className={styles.empty}>
        <div className={styles.eyebrow}>NO ONE IS LIVE YET</div>
        <h2>The room is quiet for now.</h2>
        <p className={styles.muted}>When a Hustler starts a commerce Live, it will appear here publicly.</p>
        <div className={styles.actions} style={{justifyContent:"center",marginTop:18}}><a className={styles.primary} href="/live/create">Host the first Live →</a></div>
      </section>}

      {items.length > 0 && <section className={styles.grid}>
        {items.map((item) => {
          const offer = item.pinnedService ?? item.pinnedProduct;
          return <a className={styles.card} key={item.id} href={`/live/${item.id}`}>
            <div className={styles.host}>
              <div className={styles.avatar}>{item.host.avatarUrl ? <img alt="" src={item.host.avatarUrl} /> : (item.host.displayName ?? item.host.username ?? "H").slice(0,1).toUpperCase()}</div>
              <div><strong>{item.host.displayName ?? item.host.username ?? "Hustler"}</strong><span>@{item.host.username ?? "hustler"}{item.host.verified ? " · Verified" : ""}</span></div>
            </div>
            <div><span className={styles.liveDot}>LIVE</span><h2>{item.title}</h2></div>
            <div className={styles.meta}>
              {item.category && <span className={styles.pill}>{item.category}</span>}
              <span className={styles.pill}>{item.interactions.viewers} watching</span>
              <span className={styles.pill}>{item.interactions.comments} comments</span>
            </div>
            <div className={styles.offer}>
              {offer ? <><span className={styles.eyebrow}>PINNED {item.pinnedOfferType}</span><strong>{offer.title ?? "Hustle offer"}</strong><span className={styles.muted}>{formatLiveMoney(offer.priceMinor, offer.currency)}</span></> : <span className={styles.muted}>No offer pinned yet.</span>}
            </div>
          </a>;
        })}
      </section>}
    </div>
  </main>;
}
