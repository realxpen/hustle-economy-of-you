"use client";

import { useEffect, useMemo, useState } from "react";

import {
  formatStoryRemaining,
  getActiveStories,
  type StoryRecord
} from "../../lib/story";
import styles from "./stories.module.css";

function storyVisual(story: StoryRecord) {
  if (story.type === "IMAGE" && story.mediaUrl) {
    return <img src={story.mediaUrl} alt="Hustle Story" />;
  }
  if (story.type === "VIDEO" && story.mediaUrl) {
    return <video src={story.mediaUrl} muted playsInline preload="metadata" />;
  }
  return <div className={styles.textStory} style={{ background: story.background ?? "#111111" }}>{story.text}</div>;
}

export default function StoriesPage() {
  const [stories, setStories] = useState<StoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getActiveStories()
      .then((items) => {
        if (active) setStories(items);
      })
      .catch((reason: Error) => {
        if (active) setError(reason.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const latestByCreator = useMemo(() => {
    const map = new Map<string, StoryRecord>();
    for (const story of stories) {
      if (!map.has(story.creator.id)) map.set(story.creator.id, story);
    }
    return [...map.values()];
  }, [stories]);

  return <main className={styles.shell}>
    <header className={styles.header}>
      <a className={styles.brand} href="/home">HUSTLE↗</a>
      <div className={styles.headerActions}>
        <a href="/home">Discovery</a>
        <a className={styles.primary} href="/stories/create">+ Add Story</a>
      </div>
    </header>

    <section className={styles.hero}>
      <p className={styles.eyebrow}>STORIES · EVERY HUSTLE IDENTITY · 24 HOURS</p>
      <h1>What people are doing, buying, learning and recommending now.</h1>
      <p>Stories disappear after 24 hours. Clients and Hustlers can both publish, @mention people, and reference a currently published Service or Product. A reference can lead viewers to the real offer without pretending the Story itself is a verified review.</p>
    </section>

    {latestByCreator.length > 0 && <section className={styles.storyRail} aria-label="Active Story creators">
      {latestByCreator.map((story) => {
        const name = story.creator.displayName ?? story.creator.username ?? "Hustle user";
        const initial = name.charAt(0).toUpperCase();
        return <a key={story.creator.id} className={styles.railItem} href={`/stories/${story.id}`}>
          <div className={styles.railAvatar}>
            <div className={styles.railAvatarInner}>
              {story.creator.avatarUrl ? <img src={story.creator.avatarUrl} alt="" /> : initial}
            </div>
          </div>
          <strong>{name}</strong>
          <span>{formatStoryRemaining(story.expiresAt)}</span>
        </a>;
      })}
    </section>}

    {loading && <section className={styles.loading}>Loading active Stories…</section>}
    {error && <section className={styles.error}><strong>Stories unavailable.</strong><p>{error}</p></section>}

    {!loading && !error && stories.length === 0 && <section className={styles.empty}>
      <strong>No active Stories yet.</strong>
      <p>Any signed-in Hustle user can publish the first one. Share an update, experience, recommendation or proof and reference public Hustle offers when useful.</p>
      <a href="/stories/create">Create a Story →</a>
    </section>}

    {!loading && !error && stories.length > 0 && <section className={styles.grid}>
      {stories.map((story) => {
        const name = story.creator.displayName ?? story.creator.username ?? "Hustle user";
        return <a className={styles.card} key={story.id} href={`/stories/${story.id}`}>
          <div className={styles.visual}>
            {storyVisual(story)}
            <span className={styles.watermark}>HUSTLE · @{story.creator.username ?? "user"}</span>
            {(story.service || story.product) && <div className={styles.attachmentBadge}>
              <small>{story.service ? "SERVICE REFERENCED" : "PRODUCT REFERENCED"}</small>
              <strong>{story.service?.title ?? story.product?.title ?? "Open reference"}</strong>
            </div>}
          </div>
          <div className={styles.cardBody}>
            <div className={styles.creatorLine}><strong>{name}</strong><span>{formatStoryRemaining(story.expiresAt)}</span></div>
            {story.type !== "TEXT" && story.text && <p>{story.text}</p>}
            {story.mentions.length > 0 && <small>{story.mentions.map((mention) => `@${mention.username ?? "user"}`).join(" · ")}</small>}
          </div>
        </a>;
      })}
    </section>}
  </main>;
}
