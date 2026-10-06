"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { formatStoryRemaining, getActiveStories, type StoryRecord } from "../../lib/story";
import styles from "./home-stories-row.module.css";

export function HomeStoriesRow() {
  const [stories, setStories] = useState<StoryRecord[]>([]);

  useEffect(() => {
    let active = true;
    void getActiveStories(80)
      .then((items) => {
        if (active) setStories(items);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  const latestByCreator = useMemo(() => {
    const map = new Map<string, StoryRecord>();
    for (const story of stories) {
      if (!map.has(story.creator.id)) map.set(story.creator.id, story);
    }
    return [...map.values()];
  }, [stories]);

  return <section className={styles.shell} aria-label="Active Hustle Stories">
    <Link className={styles.add} href="/stories/create"><span>+</span><strong>Your Story</strong><small>Share now</small></Link>
    {latestByCreator.map((story) => {
      const name = story.creator.displayName ?? story.creator.username ?? "Hustle user";
      const initial = name.charAt(0).toUpperCase();
      return <Link key={story.creator.id} className={styles.story} href={`/stories/${story.id}`}>
        <div className={styles.ring}><div className={styles.avatar}>{story.creator.avatarUrl ? <img src={story.creator.avatarUrl} alt="" /> : initial}</div></div>
        <strong>{story.creator.username ? `@${story.creator.username}` : name}</strong>
        <small>{formatStoryRemaining(story.expiresAt)}</small>
      </Link>;
    })}
    <Link className={styles.all} href="/stories">All Stories →</Link>
  </section>;
}
