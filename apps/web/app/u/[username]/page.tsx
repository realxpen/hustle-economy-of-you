"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { PublicProfessionalProfile } from "@hustle/types";
import { PublicReputationPanel } from "../../../components/trust/public-reputation-panel";
import { getPublicProfessionalProfile } from "../../../lib/professional-profile";
import { getPublicTrustSummary, type PublicTrustSummary } from "../../../lib/trust";
import styles from "./page.module.css";

export default function PublicProfilePage() {
  const params = useParams<{ username: string }>();
  const [data, setData] = useState<PublicProfessionalProfile | null>(null);
  const [trust, setTrust] = useState<PublicTrustSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trustError, setTrustError] = useState<string | null>(null);
  const [trustLoading, setTrustLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const username = params?.username;
    if (!username) return;

    setData(null);
    setTrust(null);
    setError(null);
    setTrustError(null);

    getPublicProfessionalProfile(username)
      .then(async (profileData) => {
        if (!active) return;
        setData(profileData);
        setTrustLoading(true);
        try {
          const summary = await getPublicTrustSummary(profileData.user.id, 8);
          if (active) setTrust(summary);
        } catch (reason) {
          if (active) setTrustError(reason instanceof Error ? reason.message : "Could not load reputation");
        } finally {
          if (active) setTrustLoading(false);
        }
      })
      .catch((reason: Error) => {
        if (active) setError(reason.message);
      });

    return () => {
      active = false;
    };
  }, [params?.username]);

  if (error) {
    return <main className={styles.shell}><section className={styles.notFound}><p>HUSTLE · PROFESSIONAL IDENTITY</p><h1>Profile unavailable.</h1><span>{error}</span><a href="/">← Hustle</a></section></main>;
  }

  if (!data) {
    return <main className={styles.shell}><p className={styles.loading}>Loading professional identity…</p></main>;
  }

  const { user, profile } = data;
  const initial = (user.displayName ?? user.username ?? "H").charAt(0).toUpperCase();
  const skills = [profile.primarySkill, ...profile.secondarySkills].filter(Boolean) as string[];

  return <main className={styles.shell}>
    <header className={styles.header}>
      <a href="/" className={styles.brand}>HUSTLE↗</a>
      <span>THE ECONOMY OF YOU</span>
    </header>

    <section className={styles.cover} style={profile.coverUrl ? { backgroundImage: `url(${profile.coverUrl})` } : undefined} />

    <section className={styles.identity}>
      <div className={styles.avatar}>{user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : initial}</div>
      <div className={styles.nameRow}>
        <div>
          <p className={styles.kicker}>PROFESSIONAL IDENTITY</p>
          <h1>{user.displayName ?? `@${user.username}`}</h1>
          <span>@{user.username} · {user.location ?? "Location not set"}</span>
          {trust && trust.reputation.reviewCount > 0 && <div className={styles.ratingLine}>
            <strong>★ {trust.reputation.averageRating?.toFixed(1)}</strong>
            <span>{trust.reputation.verifiedReviewCount} verified review{trust.reputation.verifiedReviewCount === 1 ? "" : "s"}</span>
          </div>}
        </div>
        <div className={styles.actions}>
          <div className={styles.badges}>
            <span>HUSTLER</span>
            {user.verified && <span>IDENTITY VERIFIED</span>}
            {trust?.trust.hasVerifiedReviews && <span>VERIFIED REVIEWS</span>}
          </div>
          <a className={styles.messageCta} href={`/messages/start?userId=${encodeURIComponent(user.id)}`}>Message →</a>
        </div>
      </div>
    </section>

    <section className={styles.contentGrid}>
      <article className={styles.mainStory}>
        <h2>{profile.headline}</h2>
        <div className={styles.skills}>{skills.map((skill) => <span key={skill}>{skill}</span>)}</div>
        <p className={styles.summary}>{profile.professionalSummary}</p>
        {user.bio && <p className={styles.bio}>{user.bio}</p>}
      </article>

      <aside className={styles.metaCard}>
        <div><small>PRIMARY CAPABILITY</small><strong>{profile.primarySkill}</strong></div>
        <div><small>CATEGORY</small><strong>{profile.category}</strong></div>
        <div><small>EXPERIENCE</small><strong>{profile.yearsExperience ?? 0}+ years</strong></div>
        <div><small>IDENTITY</small><strong>CLIENT + HUSTLER</strong></div>
        <p>Services, products, content and verified outcomes attach to this same Hustle identity.</p>
      </aside>
    </section>

    <section className={styles.reputationWrap}>
      {trustLoading && <div className={styles.trustState}>Loading verified reputation…</div>}
      {trustError && <div className={styles.trustError}>Reputation is temporarily unavailable: {trustError}</div>}
      {trust && <PublicReputationPanel summary={trust} />}
    </section>
  </main>;
}
