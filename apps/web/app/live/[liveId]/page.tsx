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
import { NativeLiveViewer } from "../../../components/live/native-live-viewer";
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
  const [session, setSession] = useState<LiveSessionRecord | null>(null);
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
    Promise.all([
      getPublicLiveSession(liveId),
      getLiveComments(liveId, { limit: 100 })
    ])
      .then(([nextSession, nextComments]) => {
        if (!active) return;
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
  }, [liveId, Boolean(session)]);

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
        setSession((current) => current ? {
          ...current,
          interactions: {
            ...current.interactions,
            comments: Math.max(current.interactions.comments, current.interactions.comments + incoming.length)
          }
        } : current);
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
    if (!liveId || session?.status !== "LIVE") return;
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
  const offerHref = session?.pinnedService
    ? `/services/${session.pinnedService.id}`
    : session?.pinnedProduct
      ? `/products/${session.pinnedProduct.id}`
      : null;
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

  if (!session && !error) {
    return <main className={styles.page}><div className={styles.shell}><section className={styles.empty}>Joining Live…</section></div></main>;
  }

  return <main className={styles.page}>
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <Link className={styles.brand} href="/live">HUSTLE LIVE</Link>
        <div className={styles.actions}>
          <button type="button" onClick={() => void share()}>Share</button>
          <Link href="/live">Leave Live</Link>
        </div>
      </header>

      {error && <div className={styles.error}>{error}</div>}
      {notice && <div className={styles.notice}>{notice}</div>}

      {session && <>
        <section className={styles.sectionTitle}>
          <div>
            <div className={styles.eyebrow}>{session.category ?? "LIVE COMMERCE"}</div>
            <h2>{session.title}</h2>
            <div className={styles.host} style={{ marginTop: 10 }}>
              <div className={styles.avatar}>
                {session.host.avatarUrl
                  ? <img alt="" src={session.host.avatarUrl} />
                  : (session.host.displayName ?? session.host.username ?? "H").slice(0, 1).toUpperCase()}
              </div>
              <div>
                <strong>{session.host.displayName ?? session.host.username ?? "Hustler"}</strong>
                <span>@{session.host.username ?? "hustler"}{session.host.verified ? " · Verified" : ""}</span>
              </div>
            </div>
          </div>
          <div className={styles.stats}>
            <span>{session.interactions.viewers} watching</span>
            <span>{session.interactions.comments} comments</span>
          </div>
        </section>

        <div className={styles.viewerGrid}>
          <section>
            <div className={styles.stage}>
              {session.status === "LIVE" && <div className={styles.stageBadge}>LIVE</div>}
              {session.status === "LIVE" && session.media.nativeBroadcasting
                ? <NativeLiveViewer liveId={liveId!} />
                : embedUrl
                  ? <iframe
                      src={embedUrl}
                      title={session.title}
                      allow="autoplay; encrypted-media; picture-in-picture"
                      allowFullScreen
                    />
                  : session.playbackUrl
                    ? <video src={session.playbackUrl} controls autoPlay playsInline />
                    : <div className={styles.stagePlaceholder}>
                        <div className={styles.eyebrow}>
                          {session.status === "ENDED"
                            ? "SESSION ENDED"
                            : session.media.nativeTransportAvailable
                              ? "NATIVE LIVE · WAITING FOR HOST"
                              : "LIVE ROOM ACTIVE"}
                        </div>
                        <h2>
                          {session.status === "ENDED"
                            ? "This Live has ended."
                            : session.media.nativeTransportAvailable
                              ? "The host media is reconnecting."
                              : "The commerce room is live."}
                        </h2>
                        <p>
                          {session.status === "ENDED"
                            ? "The pinned offer and session context remain available. Replay is not part of this Live beta."
                            : session.media.nativeTransportAvailable
                              ? "Hustle will reconnect the stream automatically when the host publisher returns."
                              : "Native media is not configured for this environment and no external playback source is attached."}
                        </p>
                      </div>}
            </div>

            {offer && offerHref && <div className={styles.commerceCard}>
              <div>
                <div className={styles.eyebrow}>PINNED {session.pinnedOfferType}</div>
                <h3>{offer.title ?? "Hustle offer"}</h3>
                <span className={styles.muted}>{formatLiveMoney(offer.priceMinor, offer.currency)}</span>
              </div>
              <Link
                className={`${styles.button} ${styles.primary}`}
                href={offerHref}
                onClick={() => liveId && void recordLiveEvent(liveId, offerEvent)}
              >
                {session.pinnedService ? "View & book →" : "View & buy →"}
              </Link>
            </div>}

            <div className={styles.actions} style={{ marginTop: 16 }}>
              <Link
                href={`/u/${session.host.username ?? ""}`}
                onClick={() => liveId && void recordLiveEvent(liveId, "PROFILE_CLICKED")}
              >
                View host profile
              </Link>
              {session.status === "ENDED" && <span className={styles.pill}>
                Ended {session.endedAt ? new Date(session.endedAt).toLocaleString() : ""}
              </span>}
            </div>
          </section>

          <aside className={`${styles.panel} ${styles.comments}`}>
            <div className={styles.sectionTitle} style={{ marginTop: 0 }}>
              <div>
                <div className={styles.eyebrow}>LIVE CHAT</div>
                <h2>{session.status === "LIVE" ? "Room" : "Chat history"}</h2>
              </div>
            </div>
            <div className={styles.commentList}>
              {comments.length === 0 && <p className={styles.muted}>No comments yet. Ask about the work, Service or Product.</p>}
              {comments.map((comment) => <div className={styles.comment} key={comment.id}>
                <strong>{comment.user.displayName ?? comment.user.username ?? "Hustle user"}</strong>
                <span>@{comment.user.username ?? "user"}</span>
                <p>{comment.body}</p>
              </div>)}
              <div ref={commentsEndRef} />
            </div>
            {session.status === "LIVE"
              ? <form className={styles.commentForm} onSubmit={submitComment}>
                  <input
                    maxLength={500}
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                    placeholder="Say something…"
                  />
                  <button className={styles.button} disabled={busy || !body.trim()}>
                    {busy ? "…" : "Send"}
                  </button>
                </form>
              : <p className={styles.hint}>This Live has ended, so the room is now read-only.</p>}
          </aside>
        </div>
      </>}
    </div>
  </main>;
}
