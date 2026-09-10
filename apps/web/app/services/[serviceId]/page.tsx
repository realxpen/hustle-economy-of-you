"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { PublicService } from "@hustle/types";
import { formatServicePrice, getPublicService } from "../../../lib/service";
import styles from "./page.module.css";

function isVideo(url: string) {
  return /\.(mp4|webm|mov)(\?|$)/i.test(url);
}

export default function PublicServicePage() {
  const params = useParams<{ serviceId: string }>();
  const [data, setData] = useState<PublicService | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const serviceId = params?.serviceId;
    if (!serviceId) return;
    getPublicService(serviceId).then(setData).catch((reason: Error) => setError(reason.message));
  }, [params?.serviceId]);

  if (error) return <main className={styles.shell}><section className={styles.notFound}><p>HUSTLE · SERVICE</p><h1>Service unavailable.</h1><span>{error}</span><a href="/">← Hustle</a></section></main>;
  if (!data) return <main className={styles.shell}><p className={styles.loading}>Loading service…</p></main>;

  const { service, owner } = data;
  const initial = (owner.displayName ?? owner.username ?? "H").charAt(0).toUpperCase();

  return <main className={styles.shell}>
    <header className={styles.header}><a href="/" className={styles.brand}>HUSTLE↗</a><span>THE ECONOMY OF YOU</span></header>

    <section className={styles.hero}>
      <div className={styles.offer}>
        <p>{service.category} · {service.deliveryMode}</p>
        <h1>{service.title}</h1>
        <strong>{formatServicePrice(service)}</strong>
        <div className={styles.offerActions}>
          <a className={styles.bookButton} href={`/bookings/new/${service.id}`}>Book this service →</a>
          <a className={styles.messageButton} href={`/messages/start?userId=${encodeURIComponent(owner.id)}&contextType=SERVICE&contextId=${encodeURIComponent(service.id)}`}>Message first</a>
        </div>
      </div>
      <aside className={styles.ownerCard}>
        <div className={styles.avatar}>{owner.avatarUrl ? <img src={owner.avatarUrl} alt="" /> : initial}</div>
        <small>SERVICE BY</small>
        <h2>{owner.displayName ?? `@${owner.username}`}</h2>
        <p>@{owner.username} · {owner.location ?? "Location not set"}</p>
        <div className={styles.badges}><span>HUSTLER</span>{owner.verified && <span>VERIFIED</span>}</div>
        <a href={`/messages/start?userId=${encodeURIComponent(owner.id)}&contextType=SERVICE&contextId=${encodeURIComponent(service.id)}`}>Message about this service →</a>
        {owner.username && <a href={`/u/${owner.username}`}>View professional identity ↗</a>}
      </aside>
    </section>

    {service.mediaUrls.length > 0 && <section className={styles.mediaGrid}>{service.mediaUrls.map((url) => isVideo(url) ? <video key={url} controls src={url} /> : <img key={url} src={url} alt="Service media" />)}</section>}

    <section className={styles.contentGrid}>
      <article className={styles.description}>
        <p className={styles.kicker}>THE OFFER</p>
        <p>{service.description}</p>
        {service.requirements && <><h3>What I need from you</h3><p>{service.requirements}</p></>}
      </article>
      <aside className={styles.details}>
        <div><small>PRICE</small><strong>{formatServicePrice(service)}</strong></div>
        <div><small>DELIVERY</small><strong>{service.deliveryTime}</strong></div>
        <div><small>MODE</small><strong>{service.deliveryMode}</strong></div>
        <div><small>LOCATION</small><strong>{service.location ?? "Remote"}</strong></div>
        <div><small>AVAILABILITY</small><strong>{service.availabilityNote}</strong></div>
        <p>Booking requests now preserve the Service terms and schedule. Paid bookings stop at the payment boundary until Phase 13 confirms real funding.</p>
      </aside>
    </section>

    <footer className={styles.footer}><span>Published offer · same Hustle identity</span>{owner.professionalProfile.headline && <strong>{owner.professionalProfile.headline}</strong>}</footer>
  </main>;
}
