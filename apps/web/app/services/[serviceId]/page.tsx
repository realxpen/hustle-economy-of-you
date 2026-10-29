"use client";

import { ExperienceHeader } from "../../../components/navigation/experience-header";
import { ExperienceState } from "../../../components/experience/experience-state";
import { useEffect, useState } from "react";
import { OpportunityContext } from "../../../components/commerce/opportunity-context";
import { useSourcePost, withSourcePost } from "../../../lib/opportunity-source";
import { withTransactionReturnTo } from "../../../lib/transaction-return";
import { useParams } from "next/navigation";
import type { PublicService } from "@hustle/types";
import { formatServicePrice, getPublicService } from "../../../lib/service";
import styles from "./page.module.css";
import { hasViewerSession, authUrl } from "../../../lib/api/public-browsing";
import { isolatedWebMode } from "../../../lib/auth/isolated-web-auth";
import { getPublicTrustSummary, type PublicTrustSummary } from "../../../lib/trust";
import type { MouseEvent } from "react";

function isVideo(url: string) {
  return /\.(mp4|webm|mov)(\?|$)/i.test(url);
}

export default function PublicServicePage() {
  const params = useParams<{ serviceId: string }>();
  const [data, setData] = useState<PublicService | null>(null);
  const [trust, setTrust] = useState<PublicTrustSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryVersion, setRetryVersion] = useState(0);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const sourcePostId = useSourcePost();

  useEffect(() => {
    const serviceId = params?.serviceId;
    if (!serviceId) return;
    let active = true;
    setData(null);
    setError(null);
    setActiveMediaIndex(0);
    void getPublicService(serviceId)
      .then((next) => { if (active) setData(next); })
      .catch((reason: Error) => { if (active) setError(reason.message); });
    return () => { active = false; };
  }, [params?.serviceId, retryVersion]);

  useEffect(() => {
    const ownerId = data?.owner.id;
    let active = true;
    setTrust(null);
    if (ownerId) void getPublicTrustSummary(ownerId, 3)
      .then((result) => { if (active) setTrust(result); })
      .catch(() => { /* Reputation preview must never block service booking. */ });
    return () => { active = false; };
  }, [data?.owner.id]);

  const currentData = data?.service.id === params?.serviceId ? data : null;
  if (error && !currentData) return <main className={styles.shell}><ExperienceState kind="error" title="Service unavailable." description={error} action={{ label: "Try loading again", onClick: () => setRetryVersion((n) => n + 1) }} /></main>;
  if (!currentData) return <main className={styles.shell}><ExperienceState kind="loading" title="Loading Service details…" /></main>;

  const { service, owner } = currentData;
  const selectedMedia = service.mediaUrls[Math.min(activeMediaIndex, service.mediaUrls.length - 1)];
  const initial = (owner.displayName ?? owner.username ?? "H").charAt(0).toUpperCase();
  const preparedBookingHref = withSourcePost(`/bookings/new/${encodeURIComponent(service.id)}`, sourcePostId);
  const consultHref = withTransactionReturnTo(`/messages/start?userId=${encodeURIComponent(owner.id)}&contextType=SERVICE&contextId=${encodeURIComponent(service.id)}`, preparedBookingHref);
  function requireAuthForAction(event: MouseEvent<HTMLAnchorElement>, target: string) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    event.preventDefault();
    void hasViewerSession().then(signedIn => window.location.assign(signedIn ? target : authUrl(target)))
      .catch(() => window.location.assign(authUrl(target)));
  }

  return <main className={[styles.shell, "h-experience-shell"].join(" ")}>
    <ExperienceHeader section="Service" trail={[{ href: "/marketplace", label: "Marketplace" }]} />
    <OpportunityContext sourcePostId={sourcePostId} ownerUsername={owner.username} />

    <section className={styles.mediaGallery} aria-label="Published service work gallery">
      {selectedMedia ? <>
        <div className={styles.galleryStage}>
          {isVideo(selectedMedia)
            ? <video key={selectedMedia} src={selectedMedia} controls playsInline preload="metadata" aria-label="Service work video" />
            : <img key={selectedMedia} src={selectedMedia} alt={`${service.title} — published work example`} />}
          {service.mediaUrls.length > 1 &&
            <span className={styles.galleryCounter}>{activeMediaIndex + 1} / {service.mediaUrls.length}</span>}
        </div>
        {service.mediaUrls.length > 1 && <div className={styles.galleryThumbnails} aria-label="Choose a service photo or video">
          {service.mediaUrls.map((url, index) =>
            <button key={url + index} type="button"
              className={index === activeMediaIndex ? styles.galleryActive : ""}
              aria-label={`View work example ${index + 1}`}
              aria-pressed={index === activeMediaIndex}
              onClick={() => setActiveMediaIndex(index)}>
              {isVideo(url) ? <span className={styles.videoThumbnail} aria-hidden="true">▶ Video</span>
                : <img src={url} alt="" loading="lazy"/>}
            </button>)}
        </div>}
      </> : <div className={styles.noPortfolioMedia}>
        <span aria-hidden="true">✳</span>
        <strong>Explore this service</strong>
        <small>This Hustler hasn't added work photos yet.</small>
      </div>}
    </section>

    <nav className={styles.detailTabs} aria-label="Service information">
      <a href="#service-overview">Overview</a>
      <a href="#service-details">Details</a>
      {trust && trust.reviews.items.length > 0 && <a href="#service-reviews">Reviews</a>}
    </nav>

    <section className={styles.hero}>
      <div className={styles.offer}>
        <p>{service.category} · {service.deliveryMode.replaceAll("_"," ")}</p>
        <h1 className="h-experience-heading">{service.title}</h1>
        <strong>{formatServicePrice(service)}</strong>
        <div className={styles.offerActions}>
          <a className={styles.bookButton} href={preparedBookingHref} onClick={isolatedWebMode ? undefined : (event) => requireAuthForAction(event, preparedBookingHref)}>{isolatedWebMode ? "Request a time (test) →" : "Book this service →"}</a>
          <a className={styles.messageButton} href={consultHref} onClick={(event) => requireAuthForAction(event, consultHref)}>Message first</a>
        </div>
      </div>
      <aside className={styles.ownerCard}>
        <div className={styles.avatar}>{owner.avatarUrl ? <img src={owner.avatarUrl} alt="" /> : initial}</div>
        <small>SERVICE BY</small>
        <h2>{owner.displayName ?? `@${owner.username}`}</h2>
        <p>@{owner.username} · {owner.location ?? "Location not set"}</p>
        <div className={styles.badges}><span>HUSTLER</span>{owner.verified && <span>VERIFIED</span>}</div>
        {trust && <div className={styles.reputation} aria-label="Verified client reviews">
          <strong>{trust.reputation.reviewCount > 0
            ? `★ ${trust.reputation.averageRating?.toFixed(1)} · ${trust.reputation.verifiedReviewCount} verified client review${trust.reputation.verifiedReviewCount === 1 ? "" : "s"}`
            : "No verified client reviews yet"}</strong>
          {isolatedWebMode && <small>Sandbox test reputation, not production reviews</small>}
          {trust.reviews.items[0] && <p>“{trust.reviews.items[0].body}”</p>}
        </div>}
        <a href={consultHref} onClick={(event) => requireAuthForAction(event, consultHref)}>Message about this service →</a>
        {owner.username && <a href={`/u/${owner.username}`}>View professional identity ↗</a>}
      </aside>
    </section>

    <section className={styles.contentGrid} id="service-overview">
      <article className={[styles.description, "h-experience-surface"].join(" ")}>
        <p className={styles.kicker}>THE OFFER</p>
        <p>{service.description}</p>
        {service.requirements && <><h3>What I need from you</h3><p>{service.requirements}</p></>}
      </article>
      <aside className={styles.details} id="service-details">
        <div><small>PRICE</small><strong>{formatServicePrice(service)}</strong></div>
        <div><small>DELIVERY</small><strong>{service.deliveryTime}</strong></div>
        <div><small>MODE</small><strong>{service.deliveryMode}</strong></div>
        <div><small>LOCATION</small><strong>{service.location ?? "Remote"}</strong></div>
        <div><small>AVAILABILITY</small><strong>{service.availabilityNote}</strong></div>
        <p>{isolatedWebMode ? "Discuss the service in Messages, then propose an available time. Staging bookings, escrow and wallet entries are simulated. No actual funds move." : "Bookings preserve the Service terms and schedule. Paid work is funded only after authoritative payment confirmation."}</p>
      </aside>
    </section>

    {trust && trust.reviews.items.length > 0 && <section className={styles.reviewsSection} id="service-reviews" aria-label="Verified service reviews">
      <h2>What clients say</h2>
      <p>{trust.reputation.reviewCount} verified client review{trust.reputation.reviewCount === 1 ? "" : "s"}</p>
      {trust.reviews.items.map((review, index) =>
        <blockquote key={index}>“{review.body}”</blockquote>)}
    </section>}
    <footer className={styles.footer}><span>Published offer · same Hustle identity</span>{owner.professionalProfile.headline && <strong>{owner.professionalProfile.headline}</strong>}</footer>
    <div className={styles.stickyBooking} aria-label="Service booking action">
      <div className={styles.stickyPrice}><small>Starting from</small><strong>{formatServicePrice(service)}</strong></div>
      <a href={preparedBookingHref}
        onClick={isolatedWebMode ? undefined : (event) => requireAuthForAction(event, preparedBookingHref)}>
        {isolatedWebMode ? "Request time (test)" : "Book now"} <span aria-hidden="true">↗</span>
      </a>
    </div>
  </main>;
}
