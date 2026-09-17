"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import {
  formatStoryRemaining,
  getPublicStory,
  type StoryRecord
} from "../../../lib/story";
import styles from "../stories.module.css";

function money(amountMinor: number | null, currency = "NGN") {
  if (amountMinor === null) return "Price on request";
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    maximumFractionDigits: amountMinor % 100 === 0 ? 0 : 2
  }).format(amountMinor / 100);
}

export default function StoryViewerPage() {
  const params = useParams<{ storyId: string }>();
  const [story, setStory] = useState<StoryRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const storyId = params?.storyId;
    if (!storyId) return;
    getPublicStory(storyId)
      .then((item) => {
        if (active) setStory(item);
      })
      .catch((reason: Error) => {
        if (active) setError(reason.message);
      });
    return () => {
      active = false;
    };
  }, [params?.storyId]);

  async function share() {
    if (!story) return;
    const url = window.location.href.split("#")[0]!;
    const text = story.text ?? `View @${story.creator.username ?? "this user"}'s Story on Hustle.`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Hustle Story", text, url });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setNotice("Story link copied");
        window.setTimeout(() => setNotice(null), 1800);
      }
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      setNotice("Could not share Story");
    }
  }

  if (error) {
    return <main className={styles.shell}><section className={styles.error}><strong>Story unavailable.</strong><p>{error}</p><a href="/stories">← Active Stories</a></section></main>;
  }

  if (!story) return <main className={styles.shell}><section className={styles.loading}>Opening Story…</section></main>;

  const creatorName = story.creator.displayName ?? story.creator.username ?? "Hustle user";
  const initial = creatorName.charAt(0).toUpperCase();

  return <main className={styles.viewerShell}>
    <section className={styles.viewerStage}>
      <div className={styles.viewerFrame}>
        {story.type === "IMAGE" && story.mediaUrl && <img src={story.mediaUrl} alt="Hustle Story" />}
        {story.type === "VIDEO" && story.mediaUrl && <video src={story.mediaUrl} controls autoPlay muted playsInline />}
        {story.type === "TEXT" && <div className={styles.viewerText} style={{ background: story.background ?? "#111111" }}>{story.text}</div>}

        <div className={styles.viewerTop}>
          <a href="/stories">← Stories</a>
          <button type="button" onClick={() => void share()}>Share ↗</button>
        </div>

        {story.type !== "TEXT" && story.text && <div className={styles.viewerBottom}><div className={styles.viewerCaption}>{story.text}</div></div>}
      </div>
    </section>

    <aside className={styles.sidePanel}>
      <section className={styles.profileCard}>
        <div className={styles.miniAvatar}>{story.creator.avatarUrl ? <img src={story.creator.avatarUrl} alt="" /> : initial}</div>
        <p className={styles.eyebrow}>HUSTLE STORY</p>
        <h2>{creatorName}</h2>
        <p>@{story.creator.username ?? "user"}{story.creator.verified ? " · Verified identity" : ""}</p>
        {story.creator.professionalProfile?.headline && <p>{story.creator.professionalProfile.headline}</p>}
        {story.creator.professionalProfile?.published && story.creator.username && <a href={`/u/${encodeURIComponent(story.creator.username)}`}>Visit professional storefront →</a>}
      </section>

      {story.mentions.length > 0 && <section className={styles.commerceCard}>
        <small>PEOPLE REFERENCED</small>
        <h3>{story.mentions.length} Hustle {story.mentions.length === 1 ? "identity" : "identities"}</h3>
        <p>{story.mentions.map((mention) => `@${mention.username ?? "user"}`).join(" · ")}</p>
      </section>}

      {story.service && <section className={styles.commerceCard}>
        <small>REFERENCED SERVICE</small>
        <h3>{story.service.title ?? "Service"}</h3>
        <p>{story.service.category ?? story.service.deliveryMode} · {money(story.service.priceMinor, story.service.currency)}</p>
        <a href={`/services/${encodeURIComponent(story.service.id)}`}>View & book service →</a>
      </section>}

      {story.product && <section className={styles.commerceCard}>
        <small>REFERENCED PRODUCT</small>
        <h3>{story.product.title ?? "Product"}</h3>
        <p>{story.product.category ?? story.product.type} · {money(story.product.priceMinor, story.product.currency)}</p>
        <a href={`/products/${encodeURIComponent(story.product.id)}`}>View & buy product →</a>
      </section>}

      <div className={styles.storyMeta}>
        <strong>{formatStoryRemaining(story.expiresAt)}</strong><br />
        Stories expire automatically 24 hours after publication.<br />
        Story opinions and recommendations are community content; verified transaction reviews remain a separate trust signal.<br />
        HUSTLE · THE ECONOMY OF YOU
      </div>
      {notice && <p>{notice}</p>}
    </aside>
  </main>;
}
