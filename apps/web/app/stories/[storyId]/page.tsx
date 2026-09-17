"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import {
  formatStoryRemaining,
  getActiveStories,
  getMyStoryInteraction,
  getPublicStory,
  getStoryReplies,
  reactToStory,
  recordStoryEvent,
  recordStoryView,
  removeStoryReaction,
  replyToStory,
  type StoryReaction,
  type StoryRecord,
  type StoryReply,
  type StoryViewerInteraction
} from "../../../lib/story";
import styles from "../stories.module.css";
import experience from "../experience.module.css";

const reactions: Array<{ value: StoryReaction; emoji: string; label: string }> = [
  { value: "HEART", emoji: "❤️", label: "Love" },
  { value: "FIRE", emoji: "🔥", label: "Fire" },
  { value: "CLAP", emoji: "👏", label: "Clap" },
  { value: "HUNDRED", emoji: "💯", label: "Hundred" }
];

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
  const router = useRouter();
  const [story, setStory] = useState<StoryRecord | null>(null);
  const [sequence, setSequence] = useState<StoryRecord[]>([]);
  const [viewer, setViewer] = useState<StoryViewerInteraction | null>(null);
  const [replies, setReplies] = useState<StoryReply[]>([]);
  const [replyBody, setReplyBody] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const storyId = params?.storyId;
    if (!storyId) return;

    Promise.all([
      getPublicStory(storyId),
      getActiveStories(100),
      getMyStoryInteraction(storyId).catch(() => null)
    ])
      .then(async ([item, items, nextViewer]) => {
        if (!active) return;
        setStory(item);
        setSequence(items);
        setViewer(nextViewer);
        void recordStoryView(storyId).then((result) => {
          if (!active) return;
          setStory((current) => current ? {
            ...current,
            interactions: { ...current.interactions, views: result.views }
          } : current);
        }).catch(() => undefined);

        if (nextViewer) {
          const replyPage = await getStoryReplies(storyId).catch(() => null);
          if (active && replyPage) setReplies(replyPage.items);
        }
      })
      .catch((reason: Error) => {
        if (active) setError(reason.message);
      });

    return () => { active = false; };
  }, [params?.storyId]);

  const sequenceIndex = useMemo(
    () => sequence.findIndex((item) => item.id === story?.id),
    [sequence, story?.id]
  );
  const previous = sequenceIndex >= 0 ? sequence[sequenceIndex - 1] ?? null : null;
  const next = sequenceIndex >= 0 ? sequence[sequenceIndex + 1] ?? null : null;

  function navigate(target: StoryRecord | null) {
    if (target) router.push(`/stories/${target.id}`);
  }

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

  async function chooseReaction(reaction: StoryReaction) {
    if (!story) return;
    if (!viewer) {
      window.location.assign("/auth");
      return;
    }
    setBusy("reaction");
    setNotice(null);
    try {
      const result = viewer.reaction === reaction
        ? await removeStoryReaction(story.id)
        : await reactToStory(story.id, reaction);
      setViewer({
        viewerUserId: result.viewerUserId,
        isOwner: result.isOwner,
        reaction: result.reaction,
        ownReplyCount: result.ownReplyCount
      });
      setStory((current) => current ? { ...current, interactions: result.summary } : current);
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "Could not update reaction");
    } finally {
      setBusy(null);
    }
  }

  async function sendReply(event: FormEvent) {
    event.preventDefault();
    if (!story || !replyBody.trim()) return;
    if (!viewer) {
      window.location.assign("/auth");
      return;
    }
    setBusy("reply");
    setNotice(null);
    try {
      const reply = await replyToStory(story.id, replyBody.trim());
      setReplies((current) => [...current, reply]);
      setReplyBody("");
      setViewer((current) => current ? { ...current, ownReplyCount: current.ownReplyCount + 1 } : current);
      setStory((current) => current ? {
        ...current,
        interactions: { ...current.interactions, replies: current.interactions.replies + 1 }
      } : current);
      setNotice("Private Story reply sent");
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "Could not send Story reply");
    } finally {
      setBusy(null);
    }
  }

  function recordAndNavigate(name: "PROFILE_CLICKED" | "SERVICE_CLICKED" | "PRODUCT_CLICKED", url: string) {
    if (story) void recordStoryEvent(story.id, name).catch(() => undefined);
    window.location.assign(url);
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
        {story.type === "VIDEO" && story.mediaUrl && <video src={story.mediaUrl} controls autoPlay muted playsInline onEnded={() => navigate(next)} />}
        {story.type === "TEXT" && <div className={styles.viewerText} style={{ background: story.background ?? "#111111" }}>{story.text}</div>}

        <div className={styles.viewerTop}>
          <a href="/stories">← Stories</a>
          <span>{sequenceIndex >= 0 ? `${sequenceIndex + 1}/${sequence.length}` : ""}</span>
          <button type="button" onClick={() => void share()}>Share ↗</button>
        </div>

        <button type="button" className={experience.viewerPrev} onClick={() => navigate(previous)} disabled={!previous} aria-label="Previous Story">‹</button>
        <button type="button" className={experience.viewerNext} onClick={() => navigate(next)} disabled={!next} aria-label="Next Story">›</button>
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
        {story.creator.username && <button className={experience.textLink} type="button" onClick={() => recordAndNavigate("PROFILE_CLICKED", `/u/${encodeURIComponent(story.creator.username!)}`)}>Visit profile / storefront →</button>}
      </section>

      <section className={experience.interactionCard}>
        <div className={experience.metricLine}><span>{story.interactions.views} views</span><span>{Object.values(story.interactions.reactions).reduce((sum, value) => sum + (value ?? 0), 0)} reactions</span><span>{story.interactions.replies} replies</span></div>
        {!viewer?.isOwner && <div className={experience.reactionRow}>
          {reactions.map((item) => <button key={item.value} type="button" title={item.label} className={viewer?.reaction === item.value ? experience.activeReaction : undefined} disabled={busy === "reaction"} onClick={() => void chooseReaction(item.value)}>
            <span>{item.emoji}</span><small>{story.interactions.reactions[item.value] ?? 0}</small>
          </button>)}
        </div>}

        {!viewer?.isOwner && <form className={experience.replyForm} onSubmit={sendReply}>
          <input value={replyBody} maxLength={1200} onChange={(event) => setReplyBody(event.target.value)} placeholder={viewer ? "Reply privately to this Story…" : "Sign in to reply…"} />
          <button type="submit" disabled={busy === "reply" || !replyBody.trim()}>{busy === "reply" ? "Sending…" : "Reply"}</button>
        </form>}

        {viewer && replies.length > 0 && <div className={experience.replyList}>
          <small>{viewer.isOwner ? "PRIVATE REPLIES TO YOUR STORY" : "YOUR PRIVATE REPLIES"}</small>
          {replies.map((reply) => <div key={reply.id}><strong>@{reply.user.username ?? "user"}</strong><p>{reply.body}</p></div>)}
        </div>}
        {notice && <p className={styles.notice}>{notice}</p>}
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
        <button className={experience.textLink} type="button" onClick={() => recordAndNavigate("SERVICE_CLICKED", `/services/${encodeURIComponent(story.service!.id)}`)}>View & book service →</button>
      </section>}

      {story.product && <section className={styles.commerceCard}>
        <small>REFERENCED PRODUCT</small>
        <h3>{story.product.title ?? "Product"}</h3>
        <p>{story.product.category ?? story.product.type} · {money(story.product.priceMinor, story.product.currency)}</p>
        <button className={experience.textLink} type="button" onClick={() => recordAndNavigate("PRODUCT_CLICKED", `/products/${encodeURIComponent(story.product!.id)}`)}>View & buy product →</button>
      </section>}

      <div className={styles.storyMeta}>
        <strong>{formatStoryRemaining(story.expiresAt)}</strong><br />
        Stories expire automatically 24 hours after publication.<br />
        Reactions, replies and views are social/observation signals and never change verified reputation.<br />
        HUSTLE · THE ECONOMY OF YOU
      </div>
    </aside>
  </main>;
}
