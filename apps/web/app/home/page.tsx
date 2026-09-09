"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { captureFeedEvent, getFeedPage, type FeedItem, type FeedPage, type FeedTab } from "../../lib/feed";
import {
  followUser,
  likePost,
  recordPostShare,
  savePublicPost,
  unfollowUser,
  unlikePost,
  unsavePublicPost
} from "../../lib/post";
import { formatProductPrice } from "../../lib/product";
import { formatServicePrice } from "../../lib/service";
import styles from "./page.module.css";

const tabs: Array<{ id: FeedTab; label: string; note: string }> = [
  { id: "for-you", label: "For You", note: "Relevant capability, even with zero connections." },
  { id: "nearby", label: "Nearby", note: "Useful people and work around your location." },
  { id: "connections", label: "Connections", note: "Published work from people you follow." }
];

function createSessionId() {
  const key = "hustle-feed-session";
  const existing = window.sessionStorage.getItem(key);
  if (existing) return existing;
  const next = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `feed-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  window.sessionStorage.setItem(key, next);
  return next;
}

function youtubeEmbedUrl(raw: string | null) {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    let id: string | null = null;
    if (url.hostname === "youtu.be") id = url.pathname.split("/").filter(Boolean)[0] ?? null;
    if (url.hostname.includes("youtube.com")) {
      id = url.searchParams.get("v");
      if (!id) {
        const parts = url.pathname.split("/").filter(Boolean);
        const marker = parts.findIndex((part) => part === "shorts" || part === "embed");
        if (marker >= 0) id = parts[marker + 1] ?? null;
      }
    }
    return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}` : null;
  } catch {
    return null;
  }
}

function MediaRail({ item }: { item: FeedItem }) {
  if (item.post.media.length === 0) {
    return <div className={styles.mediaFallback}>Capability in motion.</div>;
  }

  return <div className={styles.mediaRail}>
    {item.post.media.map((media) => {
      if (media.type === "VIDEO") {
        const embed = youtubeEmbedUrl(media.mediaUrl);
        if (embed) {
          return <iframe
            className={styles.media}
            key={media.id}
            src={embed}
            title="Hustle post video"
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />;
        }
        return <video className={styles.media} key={media.id} src={media.mediaUrl ?? undefined} controls playsInline preload="metadata" />;
      }
      return <img className={styles.media} key={media.id} src={media.mediaUrl ?? ""} alt="Demonstrated capability" loading="lazy" />;
    })}
  </div>;
}

function FeedCard({
  item,
  tab,
  position,
  sessionId,
  onChange,
  onCreatorFollowChange
}: {
  item: FeedItem;
  tab: FeedTab;
  position: number;
  sessionId: string;
  onChange: (next: FeedItem) => void;
  onCreatorFollowChange: (creatorId: string, following: boolean) => void;
}) {
  const cardRef = useRef<HTMLElement | null>(null);
  const viewedRef = useRef(false);
  const visibleSinceRef = useRef<number | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    void captureFeedEvent({
      name: "feed.impression",
      postId: item.post.id,
      feedTab: tab,
      position,
      sessionId
    }).catch(() => undefined);
  }, [item.post.id, position, sessionId, tab]);

  useEffect(() => {
    const node = cardRef.current;
    if (!node) return;

    const flushWatch = () => {
      const started = visibleSinceRef.current;
      if (started === null) return;
      visibleSinceRef.current = null;
      const watchMs = Date.now() - started;
      if (watchMs < 1000) return;
      void captureFeedEvent({
        name: "feed.watch",
        postId: item.post.id,
        feedTab: tab,
        position,
        sessionId,
        watchMs
      }).catch(() => undefined);
    };

    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      const visible = Boolean(entry?.isIntersecting && entry.intersectionRatio >= 0.55);
      if (visible) {
        if (!viewedRef.current) {
          viewedRef.current = true;
          void captureFeedEvent({
            name: "feed.view",
            postId: item.post.id,
            feedTab: tab,
            position,
            sessionId
          }).catch(() => undefined);
        }
        if (visibleSinceRef.current === null) visibleSinceRef.current = Date.now();
      } else {
        flushWatch();
      }
    }, { threshold: [0, 0.55, 1] });

    observer.observe(node);
    const onHidden = () => {
      if (document.visibilityState === "hidden") flushWatch();
    };
    document.addEventListener("visibilitychange", onHidden);

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onHidden);
      flushWatch();
    };
  }, [item.post.id, position, sessionId, tab]);

  async function toggleLike() {
    setWorking("like");
    setNotice(null);
    try {
      if (item.viewer.liked) {
        await unlikePost(item.post.id);
        onChange({
          ...item,
          viewer: { ...item.viewer, liked: false },
          engagement: { ...item.engagement, likes: Math.max(0, item.engagement.likes - 1) }
        });
      } else {
        await likePost(item.post.id);
        onChange({
          ...item,
          viewer: { ...item.viewer, liked: true },
          engagement: { ...item.engagement, likes: item.engagement.likes + 1 }
        });
      }
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "Could not update like");
    } finally {
      setWorking(null);
    }
  }

  async function toggleSave() {
    setWorking("save");
    setNotice(null);
    try {
      if (item.viewer.saved) {
        await unsavePublicPost(item.post.id);
        onChange({
          ...item,
          viewer: { ...item.viewer, saved: false },
          engagement: { ...item.engagement, saves: Math.max(0, item.engagement.saves - 1) }
        });
      } else {
        await savePublicPost(item.post.id);
        onChange({
          ...item,
          viewer: { ...item.viewer, saved: true },
          engagement: { ...item.engagement, saves: item.engagement.saves + 1 }
        });
      }
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "Could not update save");
    } finally {
      setWorking(null);
    }
  }

  async function toggleFollow() {
    setWorking("follow");
    setNotice(null);
    try {
      if (item.viewer.following) {
        await unfollowUser(item.creator.id);
        onCreatorFollowChange(item.creator.id, false);
      } else {
        await followUser(item.creator.id);
        onCreatorFollowChange(item.creator.id, true);
      }
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "Could not update connection");
    } finally {
      setWorking(null);
    }
  }

  async function share() {
    setWorking("share");
    setNotice(null);
    const url = `${window.location.origin}/posts/${item.post.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: item.creator.displayName ?? "Hustle", text: item.post.caption ?? undefined, url });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setNotice("Post link copied.");
      } else {
        window.prompt("Copy this Hustle link", url);
      }
      await recordPostShare(item.post.id);
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      setNotice(reason instanceof Error ? reason.message : "Could not share post");
    } finally {
      setWorking(null);
    }
  }

  const initial = (item.creator.displayName ?? item.creator.username ?? "H").charAt(0).toUpperCase();
  const skill = item.creator.professionalProfile.primarySkill ?? item.creator.professionalProfile.headline ?? item.post.category;

  return <article ref={cardRef} className={styles.card}>
    <div className={styles.cardTop}>
      <a
        className={styles.creator}
        href={item.creator.username ? `/u/${item.creator.username}` : "#"}
        onClick={() => void captureFeedEvent({
          name: "feed.profile_clicked",
          postId: item.post.id,
          feedTab: tab,
          position,
          sessionId
        }).catch(() => undefined)}
      >
        <div className={styles.avatar}>{item.creator.avatarUrl ? <img src={item.creator.avatarUrl} alt="" /> : initial}</div>
        <div>
          <strong>{item.creator.displayName ?? item.creator.username ?? "Hustler"}</strong>
          <span>@{item.creator.username ?? "hustler"}{item.creator.verified ? " · Verified" : ""}</span>
        </div>
      </a>
      <button className={item.viewer.following ? styles.following : styles.follow} type="button" onClick={toggleFollow} disabled={working === "follow"}>
        {item.viewer.following ? "Following" : "Follow"}
      </button>
    </div>

    <div className={styles.contextLine}>
      <span>{skill ?? "Capability"}</span>
      <span>{item.post.location ?? item.creator.location ?? "Location not set"}</span>
    </div>

    <MediaRail item={item} />

    <div className={styles.cardBody}>
      <div className={styles.actions}>
        <button type="button" className={item.viewer.liked ? styles.activeAction : undefined} onClick={toggleLike} disabled={working === "like"}>♥ {item.engagement.likes}</button>
        <a href={`/posts/${item.post.id}`}>◌ {item.engagement.comments}</a>
        <button type="button" className={item.viewer.saved ? styles.activeAction : undefined} onClick={toggleSave} disabled={working === "save"}>◇ {item.engagement.saves}</button>
        <button type="button" onClick={share} disabled={working === "share"}>↗ Share</button>
      </div>

      <a className={styles.captionLink} href={`/posts/${item.post.id}`}>
        <p>{item.post.caption}</p>
      </a>
      {item.post.tags.length > 0 && <div className={styles.tags}>{item.post.tags.slice(0, 6).map((tag) => <span key={tag}>#{tag}</span>)}</div>}

      {(item.services.length > 0 || item.products.length > 0) && <div className={styles.opportunityBlock}>
        <div className={styles.opportunityHeading}><span>ATTACHED OPPORTUNITIES</span><b>Proof → action</b></div>
        <div className={styles.opportunityGrid}>
          {item.services.map((service) => <a
            key={service.id}
            href={`/services/${service.id}`}
            onClick={() => void captureFeedEvent({
              name: "feed.service_clicked",
              postId: item.post.id,
              feedTab: tab,
              position,
              sessionId,
              serviceId: service.id
            }).catch(() => undefined)}
          >
            <small>SERVICE</small><strong>{service.title ?? "Service"}</strong><span>{formatServicePrice(service)}</span>
          </a>)}
          {item.products.map((product) => <a
            key={product.id}
            href={`/products/${product.id}`}
            onClick={() => void captureFeedEvent({
              name: "feed.product_clicked",
              postId: item.post.id,
              feedTab: tab,
              position,
              sessionId,
              productId: product.id
            }).catch(() => undefined)}
          >
            <small>PRODUCT</small><strong>{product.title ?? "Product"}</strong><span>{formatProductPrice(product)}</span>
          </a>)}
        </div>
      </div>}

      {notice && <p className={styles.notice}>{notice}</p>}
    </div>
  </article>;
}

export default function DiscoveryHomePage() {
  const [tab, setTab] = useState<FeedTab>("for-you");
  const [items, setItems] = useState<FeedItem[]>([]);
  const [meta, setMeta] = useState<Pick<FeedPage, "nextCursor" | "hasMore" | "viewerLocation" | "coldStart" | "reason">>({
    nextCursor: null,
    hasMore: false,
    viewerLocation: null,
    coldStart: false
  });
  const [sessionId, setSessionId] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSessionId(createSessionId());
  }, []);

  const load = useCallback(async (nextTab: FeedTab, cursor?: string | null, append = false) => {
    append ? setLoadingMore(true) : setLoading(true);
    setError(null);
    try {
      const page = await getFeedPage(nextTab, { cursor, limit: 8 });
      setItems((current) => append ? [...current, ...page.items] : page.items);
      setMeta({
        nextCursor: page.nextCursor,
        hasMore: page.hasMore,
        viewerLocation: page.viewerLocation,
        coldStart: page.coldStart,
        reason: page.reason
      });
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Could not load discovery feed";
      setError(message);
      if (message.toLowerCase().includes("sign in")) setTimeout(() => window.location.assign("/auth"), 900);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    setItems([]);
    setMeta({ nextCursor: null, hasMore: false, viewerLocation: null, coldStart: false });
    void load(tab);
  }, [load, sessionId, tab]);

  const activeTab = useMemo(() => tabs.find((item) => item.id === tab) ?? tabs[0], [tab]);

  function replaceItem(next: FeedItem) {
    setItems((current) => current.map((item) => item.post.id === next.post.id ? next : item));
  }

  function updateCreatorFollow(creatorId: string, following: boolean) {
    setItems((current) => current.map((item) => item.creator.id === creatorId
      ? { ...item, viewer: { ...item.viewer, following } }
      : item));
  }

  return <main className={styles.shell}>
    <header className={styles.header}>
      <a className={styles.brand} href="/">HUSTLE<span>↗</span></a>
      <div className={styles.headerActions}><a href="/posts/manage">Create / manage content</a><a href="/account">Your identity</a></div>
    </header>

    <section className={styles.hero}>
      <div><p>HOME · DISCOVERY</p><h1>Find people by what they can <em>do.</em></h1><span>{activeTab.note}</span></div>
      <div className={styles.locationBadge}><small>YOUR DISCOVERY LOCATION</small><strong>{meta.viewerLocation ?? "Loading…"}</strong></div>
    </section>

    <nav className={styles.tabs} aria-label="Discovery feed tabs">
      {tabs.map((item) => <button key={item.id} type="button" className={tab === item.id ? styles.activeTab : undefined} onClick={() => setTab(item.id)}>{item.label}</button>)}
    </nav>

    {meta.coldStart && tab === "for-you" && <section className={styles.coldStart}><strong>Cold start, not an empty start.</strong><span>Hustle is using location, recency, trust and useful published capability while it learns from real interactions.</span></section>}

    {loading && <section className={styles.loading}>Building your discovery feed…</section>}
    {error && <section className={styles.error}><strong>Feed unavailable.</strong><span>{error}</span><button type="button" onClick={() => void load(tab)}>Retry</button></section>}

    {!loading && !error && items.length === 0 && <section className={styles.empty}>
      <small>{tab.toUpperCase()}</small>
      <h2>{tab === "connections" ? "No connected creators in this feed yet." : "No eligible published work yet."}</h2>
      <p>{meta.reason ?? (tab === "connections" ? "Follow a Hustler from For You, then return here to see their published capability." : "Discovery will populate as eligible Hustlers publish content.")}</p>
      {tab === "connections" && <button type="button" onClick={() => setTab("for-you")}>Discover people →</button>}
    </section>}

    <section className={styles.feed}>
      {items.map((item, index) => <FeedCard
        key={`${tab}-${item.post.id}`}
        item={item}
        tab={tab}
        position={index}
        sessionId={sessionId}
        onChange={replaceItem}
        onCreatorFollowChange={updateCreatorFollow}
      />)}
    </section>

    {!loading && meta.hasMore && <div className={styles.loadMore}><button type="button" disabled={loadingMore} onClick={() => void load(tab, meta.nextCursor, true)}>{loadingMore ? "Loading…" : "Load more capability ↓"}</button></div>}

    <footer className={styles.footer}><span>Hustle — The Economy of You</span><span>Content → Discovery → Identity → Opportunity</span></footer>
  </main>;
}
