"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";

import {
  createLiveComment,
  formatLiveMoney,
  getLiveComments,
  getPublicLiveSession,
  heartbeatLiveViewer,
  leaveLiveViewer,
  recordLiveEvent,
  youtubeLiveEmbedUrl,
  type LiveCommentRecord,
  type LiveSessionRecord
} from "../../../lib/live";
import { OfferQuickView } from "../../../components/commerce/offer-quick-view";
import { NativeLiveViewer } from "../../../components/live/native-live-viewer";
import { isolatedWebMode } from "../../../lib/auth/isolated-web-auth";
import styles from "../live.module.css";

function mergeComments(current: LiveCommentRecord[], incoming: LiveCommentRecord[]) {
  const byId = new Map(current.map((comment) => [comment.id, comment]));
  for (const comment of incoming) byId.set(comment.id, comment);
  return Array.from(byId.values()).sort((left, right) => {
    const time = new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
    return time === 0 ? left.id.localeCompare(right.id) : time;
  }).slice(-100);
}

export default function LiveViewerPage() {
  const params = useParams<{ liveId: string }>();
  const liveId = params?.liveId;
  const [loadedSession, setSession] = useState<LiveSessionRecord | null>(null);
  const session = loadedSession?.id === liveId ? loadedSession : null;
  const [comments, setComments] = useState<LiveCommentRecord[]>([]);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const latestCommentRef = useRef<{ id: string; createdAt: string } | null>(null);
  const commentsEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!liveId) return;
    let active = true;
    setSession(null);
    setComments([]);
    latestCommentRef.current = null;
    setError(null);
    setNotice(null);
    Promise.all([
      getPublicLiveSession(liveId),
      getLiveComments(liveId, { limit: 100 })
    ])
      .then(([nextSession, nextComments]) => {
        if (!active || nextSession.id !== liveId) return;
        setSession(nextSession);
        setComments(nextComments);
        const latest = nextComments.at(-1);
        latestCommentRef.current = latest ? { id: latest.id, createdAt: latest.createdAt } : null;
        setError(null);
      })
      .catch((reason: Error) => {
        if (active) setError(reason.message || "Live unavailable");
      });

    return () => { active = false; };
  }, [liveId]);

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [comments.length]);

  useEffect(() => {
    if (!liveId || !session) return;
    let active = true;
    let syncing = false;
    let timer: number | null = null;

    const syncSession = async () => {
      if (!active || syncing) return;
      syncing = true;
      try {
        const next = await getPublicLiveSession(liveId);
        if (active) {
          setSession(next);
          setError(null);
        }
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Live unavailable");
      } finally {
        syncing = false;
      }
    };

    const schedule = () => {
      if (timer !== null) window.clearInterval(timer);
      const delay = document.visibilityState === "visible" ? 2_000 : 6_000;
      timer = window.setInterval(() => void syncSession(), delay);
      if (document.visibilityState === "visible") void syncSession();
    };

    schedule();
    document.addEventListener("visibilitychange", schedule);
    return () => {
      active = false;
      if (timer !== null) window.clearInterval(timer);
      document.removeEventListener("visibilitychange", schedule);
    };
  }, [liveId, session?.status]);

  useEffect(() => {
    if (!liveId || session?.status !== "LIVE") return;
    let active = true;
    let syncing = false;
    let timer: number | null = null;

    const syncComments = async () => {
      if (!active || syncing || document.visibilityState !== "visible") return;
      syncing = true;
      try {
        const incoming = await getLiveComments(liveId, {
          after: latestCommentRef.current,
          limit: 100
        });
        if (!active || incoming.length === 0) return;
        const latest = incoming.at(-1);
        if (latest) latestCommentRef.current = { id: latest.id, createdAt: latest.createdAt };
        setComments((current) => mergeComments(current, incoming));
      } catch {
        // Live chat sync is best effort; the next poll can recover.
      } finally {
        syncing = false;
      }
    };

    const schedule = () => {
      if (timer !== null) window.clearInterval(timer);
      const delay = document.visibilityState === "visible" ? 1_250 : 5_000;
      timer = window.setInterval(() => void syncComments(), delay);
      if (document.visibilityState === "visible") void syncComments();
    };

    schedule();
    document.addEventListener("visibilitychange", schedule);
    return () => {
      active = false;
      if (timer !== null) window.clearInterval(timer);
      document.removeEventListener("visibilitychange", schedule);
    };
  }, [liveId, session?.status]);

  useEffect(() => {
    if (!liveId || session?.status !== "LIVE" || isolatedWebMode) return;
    let active = true;

    const heartbeat = async () => {
      try {
        const result = await heartbeatLiveViewer(liveId);
        if (!active) return;
        setSession((current) => current ? {
          ...current,
          interactions: { ...current.interactions, viewers: result.viewers }
        } : current);
      } catch {
        // Presence naturally expires if the viewer disconnects.
      }
    };

    void heartbeat();
    const timer = window.setInterval(() => void heartbeat(), 20_000);
    return () => {
      active = false;
      window.clearInterval(timer);
      void leaveLiveViewer(liveId).catch(() => undefined);
    };
  }, [liveId, session?.status]);

  const embedUrl = useMemo(
    () => youtubeLiveEmbedUrl(session?.playbackUrl ?? null),
    [session?.playbackUrl]
  );
  const offer = session?.pinnedService ?? session?.pinnedProduct ?? null;
  const offerEvent = session?.pinnedService
    ? "SERVICE_CLICKED" as const
    : "PRODUCT_CLICKED" as const;

  async function submitComment(event: FormEvent) {
    event.preventDefault();
    if (!liveId || !body.trim() || session?.status !== "LIVE") return;
    setBusy(true);
    setError(null);
    try {
      const created = await createLiveComment(liveId, body);
      latestCommentRef.current = { id: created.id, createdAt: created.createdAt };
      setComments((items) => mergeComments(items, [created]));
      setSession((current) => current ? {
        ...current,
        interactions: { ...current.interactions, comments: current.interactions.comments + 1 }
      } : current);
      setBody("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Sign in to join the Live conversation");
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    if (!session) return;
    const url = window.location.href.split("#")[0]!;
    try {
      if (navigator.share) {
        await navigator.share({
          title: session.title,
          text: `Watch @${session.host.username ?? "this Hustler"} live on Hustle.`,
          url
        });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setNotice("Live link copied");
      }
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      setNotice("Could not share Live");
    }
  }

  if (!session) {
    return <main className={styles.immersiveRoom} data-hustle-live-room="true">
      <div className={styles.roomFallback}>
        <Link href="/live" className={styles.roomClose} aria-label="Return to LIVE">×</Link>
        <span aria-hidden="true">✳</span>
        <h1>{error ? "Can't open this Live" : "Entering the Live…"}</h1>
        <p>{error ?? "Connecting to the broadcast."}</p>
        {error && <Link href="/live" className={styles.roomReturn}>Back to LIVE</Link>}
      </div>
    </main>;
  }

  const hostName = session.host.displayName?.trim() || session.host.username || "Hustle creator";
  const liveNow = session.status === "LIVE";

  return <main className={styles.immersiveRoom} data-hustle-live-room="true">
    <section className={styles.roomCanvas} aria-label={"Live room: " + session.title}>
      <div className={styles.roomVideo}>
        {liveNow && session.media.nativeBroadcasting && !isolatedWebMode
          ? <NativeLiveViewer liveId={liveId!} />
          : embedUrl
            ? <iframe src={embedUrl} title={session.title}
                allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
            : session.playbackUrl
              ? <video src={session.playbackUrl} autoPlay playsInline muted controls
                  aria-label={"Live video: " + session.title} />
              : <div className={styles.roomStreamUnavailable}>
                  <span className={styles.roomStreamSymbol} aria-hidden="true">✳</span>
                  <strong>{liveNow ? "Waiting for the live video" : "This Live has ended"}</strong>
                  <small>{liveNow
                    ? isolatedWebMode
                      ? "Full Live media isn't enabled in AWS test yet."
                      : "The host's stream will appear when broadcasting begins."
                    : "The broadcast has ended. Replay isn't available."}</small>
                </div>}
      </div>
      <div className={styles.roomGradient} aria-hidden="true" />

      <header className={styles.roomHeader}>
        <div className={styles.roomHostInfo}>
          <span className={styles.roomAvatar}>
            {session.host.avatarUrl
              ? <img src={session.host.avatarUrl} alt="" />
              : hostName.slice(0, 1).toUpperCase()}
          </span>
          <div className={styles.roomHostNames}>
            {session.host.username
              ? <Link href={"/u/" + encodeURIComponent(session.host.username)}
                  onClick={() => liveId && !isolatedWebMode && void recordLiveEvent(liveId, "PROFILE_CLICKED").catch(() => undefined)}>
                  {hostName}
                </Link>
              : <strong>{hostName}</strong>}
            <small>{session.host.username ? "@" + session.host.username : (session.category ?? "Hustle creator")}</small>
          </div>
        </div>
        <span className={liveNow ? styles.roomLiveBadge : styles.roomEndedBadge}>
          {liveNow ? "LIVE" : "ENDED"}
        </span>
        <span className={styles.roomWatching} aria-label={session.interactions.viewers + " people watching"}>
          ◈ {session.interactions.viewers}
        </span>
        <Link href="/live" className={styles.roomClose} aria-label="Close Live">×</Link>
      </header>

      {error && <p className={styles.roomError} role="alert">{error}</p>}
      {notice && <p className={styles.roomNotice} role="status">{notice}</p>}

      <div className={styles.roomBottom}>
        <p className={styles.roomTitle}>{session.title}</p>
        <div className={styles.roomComments} aria-label="Live comments" role="log" aria-live="polite" aria-relevant="additions">
          {comments.length === 0 && <p className={styles.roomEmptyComments}>No comments yet. Ask about the work, product or service.</p>}
          {comments.map(comment => <article key={comment.id} className={styles.roomComment}>
            <span className={styles.roomCommentAvatar} aria-hidden="true">
              {comment.user.avatarUrl
                ? <img src={comment.user.avatarUrl} alt="" />
                : (comment.user.displayName ?? comment.user.username ?? "H").slice(0, 1).toUpperCase()}
            </span>
            <div>
              <strong>{comment.user.displayName ?? comment.user.username ?? "Hustle viewer"}</strong>
              <p>{comment.body}</p>
            </div>
          </article>)}
          <div ref={commentsEndRef} />
        </div>

        {offer && session.pinnedOfferType && <div className={styles.roomOffer} aria-label="Attached Live product or service">
          <span className={styles.roomOfferIcon} aria-hidden="true">{session.pinnedOfferType === "PRODUCT" ? "◇" : "✦"}</span>
          <div className={styles.roomOfferCopy}>
            <small>{session.pinnedOfferType === "PRODUCT" ? "PRODUCT IN THIS LIVE" : "SERVICE IN THIS LIVE"}</small>
            <strong>{offer.title ?? "Attached offer"}</strong>
            <span>{formatLiveMoney(offer.priceMinor, offer.currency)}</span>
          </div>
          <OfferQuickView
            type={session.pinnedOfferType}
            id={offer.id}
            label="View ↗"
            sourceLabel="LIVE"
            className={styles.roomOfferAction}
            onOpen={() => liveId && !isolatedWebMode && void recordLiveEvent(liveId, offerEvent).catch(() => undefined)}
          />
        </div>}

        <div className={styles.roomComposer}>
          {liveNow && !isolatedWebMode
            ? <form onSubmit={submitComment} className={styles.roomCommentForm}>
                <input aria-label="Write a live comment" maxLength={500}
                  value={body} onChange={event => setBody(event.target.value)}
                  placeholder="Say something…" />
                <button type="submit" disabled={busy || !body.trim()}
                  aria-label="Send live comment">{busy ? "…" : "➤"}</button>
              </form>
            : <div className={styles.roomChatRestricted} role="status">
                {liveNow ? "Live chat isn't enabled in AWS test." : "This Live has ended."}
              </div>}
          <button type="button" className={styles.roomShare} aria-label="Share Live"
            onClick={() => void share()}>↗</button>
        </div>
      </div>
    </section>
  </main>;
}
