"use client";

import { ExperienceHeader } from "../../components/navigation/experience-header";
import { ExperienceState } from "../../components/experience/experience-state";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { OfferQuickView } from "../../components/commerce/offer-quick-view";
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
  { id: "for-you", label: "For You", note: "Relevant people and content, even with zero connections." },
  { id: "nearby", label: "Nearby", note: "Useful people, experiences and work around your location." },
  { id: "connections", label: "Connections", note: "Published content from people you follow." }
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

type FeedGlyphName = "like" | "comment" | "save" | "share";
function FeedGlyph({ name, filled = false }: { name: FeedGlyphName; filled?: boolean }) {
  const attributes = { width: 25, height: 25, viewBox: "0 0 24 24", fill: filled ? "currentColor" : "none",
    stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const, "aria-hidden": true as const };
  if (name === "like") return <svg {...attributes}><path d="M20.8 4.6a5.4 5.4 0 0 0-7.6 0L12 5.8l-1.2-1.2a5.4 5.4 0 0 0-7.6 7.6L12 21l8.8-8.8a5.4 5.4 0 0 0 0-7.6z"/></svg>;
  if (name === "comment") return <svg {...attributes}><path d="M20.5 11.5a8.5 8.5 0 0 1-9 8.4 9.1 9.1 0 0 1-3.6-.8L3 20l1.2-4a8.4 8.4 0 0 1-1.2-4.5 8.5 8.5 0 0 1 8.7-8.5 8.5 8.5 0 0 1 8.8 8.5z"/><path d="M8 11h8"/></svg>;
  if (name === "save") return <svg {...attributes}><path d="M5 4.5A1.5 1.5 0 0 1 6.5 3h11A1.5 1.5 0 0 1 19 4.5V21l-7-5-7 5z"/></svg>;
  return <svg {...attributes}><path d="m13 4 7 7-7 7M20 11H9a5 5 0 0 0-5 5v4"/></svg>;
}

function FeedPostImage({ url, alt, eager }: { url: string; alt: string; eager: boolean }) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);

  return <div className={styles.mediaSlide}>
    {status !== "error" && <>
      {status === "ready" && <img className={styles.mediaBackdrop} src={url} alt="" aria-hidden="true" />}
      <img key={attempt} className={styles.mediaImage} src={url} alt={alt}
        loading={eager ? "eager" : "lazy"} fetchPriority={eager ? "high" : "auto"}
        decoding="async" onLoad={() => setStatus("ready")} onError={() => setStatus("error")} />
    </>}
    {status === "loading" && <div className={styles.mediaLoading} role="status">
      <span className={styles.loadingOrb} aria-hidden="true" />
      <span>Loading this work…</span>
    </div>}
    {status === "error" && <div className={styles.mediaError} role="alert">
      <strong>Can't show this image right now.</strong>
      <span>Other post details are still available.</span>
      <button type="button" onClick={() => { setStatus("loading"); setAttempt((n) => n + 1); }}>Try again</button>
    </div>}
  </div>;
}

function MediaRail({ item, eager }: { item: FeedItem; eager: boolean }) {
  if (item.post.media.length === 0) {
    return <div className={styles.mediaFallback}>A moment worth discovering.</div>;
  }

  return <div className={styles.mediaRail}>
    {item.post.media.map((media, index) => {
      if (media.type === "VIDEO") {
        const embed = youtubeEmbedUrl(media.mediaUrl);
        if (embed) {
          return <iframe className={styles.media} key={media.id} src={embed}
            title="Hustle post video"
            loading={eager && index === 0 ? "eager" : "lazy"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen />;
        }
        return media.mediaUrl
          ? <video className={styles.media} key={media.id} src={media.mediaUrl}
              controls muted loop playsInline preload={eager && index === 0 ? "auto" : "metadata"}
              aria-label="Hustle post video, muted by default" />
          : <div key={media.id} className={styles.mediaFallback}>This video is unavailable.</div>;
      }
      return media.mediaUrl
        ? <FeedPostImage key={media.id} url={media.mediaUrl}
            alt={"Work shared by " + (item.creator.displayName ?? item.creator.username ?? "a Hustler")}
            eager={eager && index === 0} />
        : <div key={media.id} className={styles.mediaFallback}>This image is unavailable.</div>;
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
  const footerRef = useRef<HTMLDivElement | null>(null);
  const actionTriggerRef = useRef<HTMLButtonElement | null>(null);
  const viewedRef = useRef(false);
  const visibleSinceRef = useRef<number | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [offersOpen, setOffersOpen] = useState(false);
  const [captionOpen, setCaptionOpen] = useState(false);
  const [compactActions, setCompactActions] = useState(false);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);

  // Measure actual free space above the footer. Larger Safari website text
  // and browser chrome can change available height without changing width.
  useEffect(() => {
    const card = cardRef.current;
    const footer = footerRef.current;
    if (!card || !footer) return;
    const portrait = window.matchMedia("(max-width: 760px) and (orientation: portrait)");
    const measure = () => {
      const cardRect = card.getBoundingClientRect();
      const footerRect = footer.getBoundingClientRect();
      card.style.setProperty("--post-footer-height", Math.ceil(footerRect.height) + "px");
      const available = footerRect.top - cardRect.top - 50; // post badge clearance
      const compact = portrait.matches && available < 225;
      setCompactActions((previous) => previous === compact ? previous : compact);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(card);
    observer.observe(footer);
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    portrait.addEventListener("change", measure);
    measure();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
      portrait.removeEventListener("change", measure);
    };
  }, [item.post.id]);

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
      const videos = node.querySelectorAll("video");
      if (!visible || document.visibilityState !== "visible") {
        videos.forEach((video) => video.pause());
      } else {
        // Native muted autoplay is limited to a VIDEO that leads this post.
        const video = item.post.media[0]?.type === "VIDEO" ? videos[0] : null;
        if (video && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        // Only the active native video plays, silently. Sound remains a user choice.
        video.muted = true;
        void video.play().catch(() => undefined);
        }
      }
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
      if (document.visibilityState === "hidden") { flushWatch(); node.querySelectorAll("video").forEach((video) => video.pause()); }
    };
    document.addEventListener("visibilitychange", onHidden);

    return () => {
      observer.disconnect();
      node.querySelectorAll("video").forEach((video) => video.pause());
      document.removeEventListener("visibilitychange", onHidden);
      flushWatch();
    };
  }, [item.post.id, position, sessionId, tab]);

  async function toggleLike() {
    if (working === "like") return;
    const wasLiked = item.viewer.liked;
    const optimistic: FeedItem = {
      ...item,
      viewer: { ...item.viewer, liked: !wasLiked },
      engagement: {
        ...item.engagement,
        likes: Math.max(0, item.engagement.likes + (wasLiked ? -1 : 1))
      }
    };

    setWorking("like");
    setNotice(null);
    onChange(optimistic);
    try {
      if (wasLiked) await unlikePost(item.post.id);
      else await likePost(item.post.id);
    } catch (reason) {
      onChange(item);
      setNotice(reason instanceof Error ? reason.message : "Could not update like");
    } finally {
      setWorking(null);
    }
  }

  async function toggleSave() {
    if (working === "save") return;
    const wasSaved = item.viewer.saved;
    const optimistic: FeedItem = {
      ...item,
      viewer: { ...item.viewer, saved: !wasSaved },
      engagement: {
        ...item.engagement,
        saves: Math.max(0, item.engagement.saves + (wasSaved ? -1 : 1))
      }
    };

    setWorking("save");
    setNotice(null);
    onChange(optimistic);
    try {
      if (wasSaved) await unsavePublicPost(item.post.id);
      else await savePublicPost(item.post.id);
    } catch (reason) {
      onChange(item);
      setNotice(reason instanceof Error ? reason.message : "Could not update save");
    } finally {
      setWorking(null);
    }
  }

  async function toggleFollow() {
    if (working === "follow") return;
    const wasFollowing = item.viewer.following;
    setWorking("follow");
    setNotice(null);
    onCreatorFollowChange(item.creator.id, !wasFollowing);
    try {
      if (wasFollowing) await unfollowUser(item.creator.id);
      else await followUser(item.creator.id);
    } catch (reason) {
      onCreatorFollowChange(item.creator.id, wasFollowing);
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
      void recordPostShare(item.post.id).catch(() => undefined);
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      setNotice(reason instanceof Error ? reason.message : "Could not share post");
    } finally {
      setWorking(null);
    }
  }

  const initial = (item.creator.displayName ?? item.creator.username ?? "H").charAt(0).toUpperCase();
  const skill = item.creator.professionalProfile.primarySkill ?? item.creator.professionalProfile.headline ?? item.post.category;
  const creatorHref = item.creator.username ? `/u/${item.creator.username}` : "/home";

  const offerCount = item.services.length + item.products.length;
  const hasMedia = item.post.media.length > 0;

  return <article ref={cardRef} className={styles.card} aria-label={"Post by " + (item.creator.displayName ?? item.creator.username ?? "a Hustler")}>
    <div className={styles.postCanvas}>
      <MediaRail item={item} eager={position === 0} />
    <div className={styles.mediaShade} aria-hidden="true" />
    <div className={styles.postBadge}>
      <span>HUSTLE</span>
      <span className={styles.postBadgeDivider} aria-hidden="true">·</span>
      <span>{skill ?? item.post.category ?? "CREATOR"}</span>
      {item.post.media.length > 1 && <span className={styles.mediaCount}>{item.post.media.length} media · swipe sideways</span>}
      {!hasMedia && <span className={styles.mediaCount}>TEXT POST</span>}
    </div>

    <div ref={footerRef} className={[styles.cardBody, offersOpen ? styles.cardBodyOffersOpen : ""].join(" ")}>
      <div className={styles.creatorRow}>
        <Link className={styles.creator} href={creatorHref} onClick={() => void captureFeedEvent({
          name: "feed.profile_clicked", postId: item.post.id, feedTab: tab, position, sessionId
        }).catch(() => undefined)}>
          <span className={styles.avatar}>{item.creator.avatarUrl ? <img src={item.creator.avatarUrl} alt="" /> : initial}</span>
          <span className={styles.creatorName}>
            <strong>{item.creator.displayName ?? item.creator.username ?? "Hustle user"} {item.creator.verified && <span className={styles.verification} aria-label="Verified creator">✓</span>}</strong>
            <small>{"@" + (item.creator.username ?? "user")}{item.post.location || item.creator.location ? " · " + (item.post.location ?? item.creator.location) : ""}</small>
          </span>
        </Link>
        <button className={item.viewer.following ? styles.following : styles.follow} type="button"
          onClick={toggleFollow} disabled={working === "follow"} aria-pressed={item.viewer.following}>
          {item.viewer.following ? "Following" : "Follow"}
        </button>
      </div>

      {item.post.caption && <div className={styles.captionWrap}>
        <p className={captionOpen ? styles.expandedCaption : styles.caption}>{item.post.caption}</p>
        {item.post.caption.length > 110 && <button type="button" aria-expanded={captionOpen}
          onClick={() => setCaptionOpen((previous) => !previous)}>{captionOpen ? "Less" : "More"}</button>}
      </div>}
      {item.post.tags.length > 0 && <div className={styles.tags}>{item.post.tags.slice(0, 3).map((tag) => <span key={tag}>#{tag}</span>)}</div>}

      {offerCount > 0 && <section className={styles.opportunityDock} aria-label="Services and products attached to this post">
        <button className={styles.offerToggle} type="button" aria-expanded={offersOpen}
          onClick={() => { setActionMenuOpen(false); setOffersOpen((previous) => !previous); }}>
          <span className={styles.offerIcon} aria-hidden="true">↗</span>
          <span><strong>{offerCount} attached {offerCount === 1 ? "offer" : "offers"}</strong></span>
          <b aria-hidden="true">{offersOpen ? "−" : "+"}</b>
        </button>
        {offersOpen && <div className={styles.opportunityBlock}>
          <div className={styles.opportunityGrid}>
            {item.services.map((service) => <div className={styles.opportunityCard} key={service.id}>
              <small>SERVICE</small><strong>{service.title ?? "Service"}</strong>
              <span>{formatServicePrice(service)}</span>
              <OfferQuickView type="SERVICE" id={service.id} label="View service ↗" sourceLabel="POST"
                className={styles.opportunityQuickView} onOpen={() => void captureFeedEvent({
                  name: "feed.service_clicked", postId: item.post.id, feedTab: tab, position, sessionId, serviceId: service.id
                }).catch(() => undefined)} />
            </div>)}
            {item.products.map((product) => <div className={styles.opportunityCard} key={product.id}>
              <small>PRODUCT</small><strong>{product.title ?? "Product"}</strong>
              <span>{formatProductPrice(product)}</span>
              <OfferQuickView type="PRODUCT" id={product.id} label="View product ↗" sourceLabel="POST"
                className={styles.opportunityQuickView} onOpen={() => void captureFeedEvent({
                  name: "feed.product_clicked", postId: item.post.id, feedTab: tab, position, sessionId, productId: product.id
                }).catch(() => undefined)} />
            </div>)}
          </div>
        </div>}
      </section>}
      {notice && <p className={styles.notice} role="status">{notice}</p>}
    </div>
    </div>
    {compactActions && !offersOpen && <button
      ref={actionTriggerRef}
      type="button"
      className={styles.actionMenuTrigger}
      aria-label={actionMenuOpen ? "Close post actions" : "Open post actions"}
      aria-controls={"post-actions-" + item.post.id}
      aria-expanded={actionMenuOpen}
      onClick={() => setActionMenuOpen((previous) => !previous)}>
      <span aria-hidden="true">{actionMenuOpen ? "×" : "···"}</span>
      <small>Actions</small>
    </button>}
    <div id={"post-actions-" + item.post.id}
      className={[styles.actionRail,
        offersOpen ? styles.railBehindOffers : "",
        compactActions ? styles.railCompact : "",
        compactActions && !actionMenuOpen ? styles.railCompactClosed : ""].join(" ")}
      aria-label="Post actions"
      onKeyDown={(event) => {
        if (event.key === "Escape" && compactActions) {
          event.stopPropagation();
          setActionMenuOpen(false);
          actionTriggerRef.current?.focus();
        }
      }}>
      <button className={item.viewer.liked ? styles.activeAction : undefined} type="button"
        aria-label={item.viewer.liked ? "Unlike post" : "Like post"} aria-pressed={item.viewer.liked}
        onClick={toggleLike} disabled={working === "like"}>
        <span className={styles.actionDisc}><FeedGlyph name="like" filled={item.viewer.liked} /></span>
        <span className={styles.actionNumber}>{item.engagement.likes}</span>
      </button>
      <Link href={"/posts/" + item.post.id} aria-label={"View " + item.engagement.comments + " comments"}>
        <span className={styles.actionDisc}><FeedGlyph name="comment" /></span>
        <span className={styles.actionNumber}>{item.engagement.comments}</span>
      </Link>
      <button className={item.viewer.saved ? styles.activeAction : undefined} type="button"
        aria-label={item.viewer.saved ? "Remove saved post" : "Save post"} aria-pressed={item.viewer.saved}
        onClick={toggleSave} disabled={working === "save"}>
        <span className={styles.actionDisc}><FeedGlyph name="save" filled={item.viewer.saved} /></span>
        <span className={styles.actionNumber}>{item.engagement.saves}</span>
      </button>
      <button type="button" aria-label="Share post" onClick={share} disabled={working === "share"}>
        <span className={styles.actionDisc}><FeedGlyph name="share" /></span>
        <span className={styles.actionNumber}>Share</span>
      </button>
    </div>

  </article>;
}

export default function DiscoveryHomePage() {
  const router = useRouter();
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
  const [pageError, setPageError] = useState<string | null>(null);
  const feedRef = useRef<HTMLElement | null>(null);
  const paginationTrigger = useRef<HTMLButtonElement | null>(null);
  const requestVersion = useRef(0);
  const paginationInFlight = useRef(false);

  useEffect(() => {
    setSessionId(createSessionId());
  }, []);

  const load = useCallback(async (nextTab: FeedTab, cursor?: string | null, append = false) => {
    if (append && (paginationInFlight.current || !cursor)) return;
    const version = append ? requestVersion.current : ++requestVersion.current;
    if (append) paginationInFlight.current = true;
    append ? setLoadingMore(true) : setLoading(true);
    if (append) setPageError(null);
    else { setError(null); setPageError(null); }
    try {
      const page = await getFeedPage(nextTab, { cursor, limit: 8 });
      if (version !== requestVersion.current) return;
      setItems((current) => append
        ? [...current, ...page.items.filter((item) => !current.some((existing) => existing.post.id === item.post.id))]
        : page.items);
      setMeta({
        nextCursor: page.nextCursor,
        hasMore: page.hasMore,
        viewerLocation: page.viewerLocation,
        coldStart: page.coldStart,
        reason: page.reason
      });
    } catch (reason) {
      if (version !== requestVersion.current) return;
      const message = reason instanceof Error ? reason.message : "Could not load discovery feed";
      if (append) setPageError(message);
      else setError(message);
      if (message.toLowerCase().includes("sign in")) setTimeout(() => router.replace("/auth"), 900);
    } finally {
      if (append) paginationInFlight.current = false;
      if (version === requestVersion.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [router]);

  useEffect(() => {
    if (!sessionId) return;
    setItems([]);
    setMeta({ nextCursor: null, hasMore: false, viewerLocation: null, coldStart: false });
    if (feedRef.current) feedRef.current.scrollTop = 0;
    void load(tab);
  }, [load, sessionId, tab]);

  useEffect(() => {
    const trigger = paginationTrigger.current;
    const feed = feedRef.current;
    if (!trigger || !feed || !meta.hasMore || !meta.nextCursor || loading || loadingMore || error || pageError) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        observer.disconnect();
        void load(tab, meta.nextCursor, true);
      }
    }, { root: feed, rootMargin: "180px 0px" });
    observer.observe(trigger);
    return () => observer.disconnect();
  }, [tab, meta.hasMore, meta.nextCursor, loading, loadingMore, error, pageError, items.length, load]);

  const activeTab = useMemo(() => tabs.find((item) => item.id === tab) ?? tabs[0], [tab]);

  function replaceItem(next: FeedItem) {
    setItems((current) => current.map((item) => item.post.id === next.post.id ? next : item));
  }

  function updateCreatorFollow(creatorId: string, following: boolean) {
    setItems((current) => current.map((item) => item.creator.id === creatorId
      ? { ...item, viewer: { ...item.viewer, following } }
      : item));
  }

  return <main className={[styles.shell, "h-experience-shell", "h-adaptive", "h-discover-immersive"].join(" ")}>
    <ExperienceHeader section="Discover" />

    <section className={styles.discoverLayout} aria-label="Hustle Discovery">
      <div className={styles.playerColumn}>
        <div className={styles.feedTopBar}>
          <div className={styles.feedHeading}>
            <strong>Discover<span>.</span></strong>
            <small>Real people. Real work.</small>
          </div>
          <nav className={styles.tabs} aria-label="Discovery feed tabs">
            {tabs.map((option) => <button key={option.id} type="button"
              className={tab === option.id ? styles.activeTab : undefined}
              aria-pressed={tab === option.id} onClick={() => setTab(option.id)}>{option.label}</button>)}
            <Link className={styles.tabLink} href="/live">Live</Link>
          </nav>
          <div className={styles.quickLinks}>
            <Link href="/stories" aria-label="View Hustle Stories" title="Stories">◉</Link>
            <Link href="/posts/manage" aria-label="Create or manage posts" title="Create or manage posts">+</Link>
            <Link href="/search" aria-label="Search people, skills, services and products" title="Search Hustle">⌕</Link>
          </div>
        </div>

        {meta.coldStart && tab === "for-you" && <p className={styles.coldStart}>Showing recently published work and relevant creators while your discoveries develop.</p>}

        {loading && <ExperienceState kind="loading" title="Finding your next discovery…" description="Loading real creators and their work." />}
        {error && <ExperienceState kind="error" title="Discovery unavailable." description={error}
          action={{ label: "Try again", onClick: () => void load(tab) }} />}
        {!loading && !error && items.length === 0 && <ExperienceState kind="empty"
          title={tab === "connections" ? "Your connections feed is ready." : "No published work here yet."}
          description={meta.reason ?? (tab === "connections"
            ? "Follow creators from For You and their posts will appear here."
            : "Switch discovery views or explore the marketplace while new work arrives.")}
          action={tab === "connections"
            ? { label: "Explore For You", onClick: () => setTab("for-you") }
            : { label: "Explore Marketplace", href: "/marketplace" }} />}

        {!loading && !error && items.length > 0 && <section ref={feedRef} className={styles.feed}
          aria-label="Immersive discovery posts. Swipe vertically or focus and use the arrow keys for the next post."
          tabIndex={0}
          onKeyDown={(event) => {
            // Keep native focus behavior on media, offer and engagement controls.
            if (event.target !== event.currentTarget) return;
            if (event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "PageDown" && event.key !== "PageUp") return;
            event.preventDefault();
            const next = event.key === "ArrowDown" || event.key === "PageDown" ? 1 : -1;
            const stage = event.currentTarget;
            const itemHeight = stage.clientHeight;
            const current = Math.round(stage.scrollTop / itemHeight);
            const target = Math.max(0, current + next);
            stage.scrollTo({ top: target * itemHeight,
              behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
          }}>
          {items.map((item, index) => <FeedCard
            key={tab + "-" + item.post.id} item={item} tab={tab} position={index}
            sessionId={sessionId} onChange={replaceItem} onCreatorFollowChange={updateCreatorFollow}
          />)}
          {meta.hasMore && <div className={styles.paginationFrame}>
            {pageError && <p className={styles.paginationError} role="alert">{pageError} · Retry when ready.</p>}
            <button ref={paginationTrigger} className={styles.loadNext} type="button"
              disabled={loadingMore} onClick={() => void load(tab, meta.nextCursor, true)}>
              {loadingMore ? "Loading more work…" : "Discover more posts ↓"}
            </button>
          </div>}
        </section>}
        <div className={styles.feedFootnote} aria-live="polite">
          <span>{activeTab.note}</span><span>Scroll ↑ ↓ to explore</span>
        </div>
      </div>


    </section>
  </main>;
}
