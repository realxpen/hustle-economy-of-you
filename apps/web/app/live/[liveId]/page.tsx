"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import {
  createLiveComment,
  formatLiveMoney,
  getLiveComments,
  getPublicLiveSession,
  heartbeatLiveViewer,
  recordLiveEvent,
  youtubeLiveEmbedUrl,
  type LiveCommentRecord,
  type LiveSessionRecord
} from "../../../lib/live";
import styles from "../live.module.css";

export default function LiveViewerPage() {
  const params = useParams<{ liveId: string }>();
  const liveId = params?.liveId;
  const [session, setSession] = useState<LiveSessionRecord | null>(null);
  const [comments, setComments] = useState<LiveCommentRecord[]>([]);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!liveId) return;
    let active = true;
    const refresh = async () => {
      try {
        const [nextSession, nextComments] = await Promise.all([
          getPublicLiveSession(liveId),
          getLiveComments(liveId)
        ]);
        if (!active) return;
        setSession(nextSession);
        setComments(nextComments);
        if (nextSession.status === "LIVE") {
          void heartbeatLiveViewer(liveId).then((result) => {
            if (!active) return;
            setSession((current) => current ? {
              ...current,
              interactions: { ...current.interactions, viewers: result.viewers }
            } : current);
          }).catch(() => undefined);
        }
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Live unavailable");
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [liveId]);

  const embedUrl = useMemo(() => youtubeLiveEmbedUrl(session?.playbackUrl ?? null), [session?.playbackUrl]);
  const offer = session?.pinnedService ?? session?.pinnedProduct ?? null;
  const offerHref = session?.pinnedService ? `/services/${session.pinnedService.id}` : session?.pinnedProduct ? `/products/${session.pinnedProduct.id}` : null;
  const offerEvent = session?.pinnedService ? "SERVICE_CLICKED" as const : "PRODUCT_CLICKED" as const;

  async function submitComment(event: FormEvent) {
    event.preventDefault();
    if (!liveId || !body.trim()) return;
    setBusy(true); setError(null);
    try {
      const created = await createLiveComment(liveId, body);
      setComments((items) => [...items, created]);
      setBody("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Sign in to join the Live conversation");
    } finally { setBusy(false); }
  }

  async function share() {
    if (!session) return;
    const url = window.location.href.split("#")[0]!;
    try {
      if (navigator.share) await navigator.share({ title: session.title, text: `Watch @${session.host.username ?? "this Hustler"} live on Hustle.`, url });
      else if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(url); setNotice("Live link copied"); }
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      setNotice("Could not share Live");
    }
  }

  if (!session && !error) return <main className={styles.page}><div className={styles.shell}><section className={styles.empty}>Joining Live…</section></div></main>;

  return <main className={styles.page}>
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <a className={styles.brand} href="/live">HUSTLE LIVE</a>
        <div className={styles.actions}><button type="button" onClick={() => void share()}>Share</button><a href="/live">All Live</a></div>
      </header>
      {error && <div className={styles.error}>{error}</div>}
      {notice && <div className={styles.notice}>{notice}</div>}

      {session && <>
        <section className={styles.sectionTitle}>
          <div>
            <div className={styles.eyebrow}>{session.category ?? "LIVE COMMERCE"}</div>
            <h2>{session.title}</h2>
            <div className={styles.host} style={{marginTop:10}}>
              <div className={styles.avatar}>{session.host.avatarUrl ? <img alt="" src={session.host.avatarUrl} /> : (session.host.displayName ?? session.host.username ?? "H").slice(0,1).toUpperCase()}</div>
              <div><strong>{session.host.displayName ?? session.host.username ?? "Hustler"}</strong><span>@{session.host.username ?? "hustler"}{session.host.verified ? " · Verified" : ""}</span></div>
            </div>
          </div>
          <div className={styles.stats}><span>{session.interactions.viewers} watching</span><span>{session.interactions.comments} comments</span></div>
        </section>

        <div className={styles.viewerGrid}>
          <section>
            <div className={styles.stage}>
              {session.status === "LIVE" && <div className={styles.stageBadge}>LIVE</div>}
              {embedUrl ? <iframe src={embedUrl} title={session.title} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen /> : session.playbackUrl ? <video src={session.playbackUrl} controls autoPlay playsInline /> : <div className={styles.stagePlaceholder}>
                <div className={styles.eyebrow}>{session.status === "ENDED" ? "SESSION ENDED" : "LIVE ROOM ACTIVE"}</div>
                <h2>{session.status === "ENDED" ? "This Live has ended." : "The commerce room is live."}</h2>
                <p>{session.status === "ENDED" ? "The transaction links and session context remain available, but there is no replay media in the foundation slice." : "This host has not attached a playback source. Hustle is preserving the real session, comments and commerce state without pretending a placeholder is video."}</p>
              </div>}
            </div>

            {offer && offerHref && <div className={styles.commerceCard}>
              <div><div className={styles.eyebrow}>PINNED {session.pinnedOfferType}</div><h3>{offer.title ?? "Hustle offer"}</h3><span className={styles.muted}>{formatLiveMoney(offer.priceMinor, offer.currency)}</span></div>
              <a className={`${styles.button} ${styles.primary}`} href={offerHref} onClick={() => liveId && void recordLiveEvent(liveId, offerEvent)}>{session.pinnedService ? "View & book →" : "View & buy →"}</a>
            </div>}

            <div className={styles.actions} style={{marginTop:16}}>
              <a href={`/u/${session.host.username ?? ""}`} onClick={() => liveId && void recordLiveEvent(liveId, "PROFILE_CLICKED")}>View host profile</a>
              {session.status === "ENDED" && <span className={styles.pill}>Ended {session.endedAt ? new Date(session.endedAt).toLocaleString() : ""}</span>}
            </div>
          </section>

          <aside className={`${styles.panel} ${styles.comments}`}>
            <div className={styles.sectionTitle} style={{marginTop:0}}><div><div className={styles.eyebrow}>LIVE CHAT</div><h2>Room</h2></div></div>
            <div className={styles.commentList}>
              {comments.length === 0 && <p className={styles.muted}>No comments yet. Ask about the work, Service or Product.</p>}
              {comments.map((comment) => <div className={styles.comment} key={comment.id}><strong>{comment.user.displayName ?? comment.user.username ?? "Hustle user"}</strong><span>@{comment.user.username ?? "user"}</span><p>{comment.body}</p></div>)}
            </div>
            {session.status === "LIVE" && <form className={styles.commentForm} onSubmit={submitComment}><input maxLength={500} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Say something…" /><button className={styles.button} disabled={busy}>{busy ? "…" : "Send"}</button></form>}
          </aside>
        </div>
      </>}
    </div>
  </main>;
}
