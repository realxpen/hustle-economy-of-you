"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { PublicProfessionalProfile } from "@hustle/types";
import { getPublicProfessionalProfile } from "../../../lib/professional-profile";
import styles from "./page.module.css";

export default function PublicProfilePage() {
  const params = useParams<{ username: string }>();
  const [data, setData] = useState<PublicProfessionalProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const username = params?.username;
    if (!username) return;
    getPublicProfessionalProfile(username)
      .then(setData)
      .catch((reason: Error) => setError(reason.message));
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
        </div>
        <div className={styles.badges}><span>HUSTLER</span>{user.verified && <span>VERIFIED</span>}</div>
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
        <p>Services, products, content and verified outcomes will attach to this same identity as Hustle evolves.</p>
      </aside>
    </section>
  </main>;
}
