"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import type { Product, Service } from "@hustle/types";

import {
  createLiveComment,
  endLiveSession,
  getLiveComments,
  getMyLiveSession,
  pinLiveOffer,
  startLiveSession,
  updateLiveSession,
  type LiveCommentRecord,
  type LiveSessionRecord
} from "../../../../lib/live";
import { getMyProducts } from "../../../../lib/product";
import { getMyServices } from "../../../../lib/service";
import { NativeLiveBroadcaster } from "../../../../components/live/native-live-broadcaster";
import styles from "../../live.module.css";

export default function LiveControlRoomPage() {
  const params = useParams<{ liveId: string }>();
  const liveId = params?.liveId;
  const [session, setSession] = useState<LiveSessionRecord | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [comments, setComments] = useState<LiveCommentRecord[]>([]);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [playbackUrl, setPlaybackUrl] = useState("");
  const [commentBody, setCommentBody] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [mediaConnected, setMediaConnected] = useState(false);

  useEffect(() => {
    if (!liveId) return;
    let active = true;
    Promise.all([getMyLiveSession(liveId), getMyServices(), getMyProducts()])
      .then(([item, serviceItems, productItems]) => {
        if (!active) return;
        setSession(item);
        setTitle(item.title);
        setCategory(item.category ?? "");
        setPlaybackUrl(item.playbackUrl ?? "");
        setServices(serviceItems.filter((service) => service.status === "PUBLISHED"));
        setProducts(productItems.filter((product) => product.status === "PUBLISHED"));
      })
      .catch((reason: Error) => { if (active) setError(reason.message); });
    return () => { active = false; };
  }, [liveId]);

  useEffect(() => {
    if (!liveId || session?.status !== "LIVE") return;
    let active = true;
    const refresh = async () => {
      try {
        const [nextSession, nextComments] = await Promise.all([getMyLiveSession(liveId), getLiveComments(liveId)]);
        if (active) {
          setSession(nextSession);
          setComments(nextComments);
        }
      } catch { /* polling is best effort */ }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 3500);
    return () => { active = false; window.clearInterval(timer); };
  }, [liveId, session?.status]);

  const selectedPin = useMemo(() => {
    if (!session?.pinnedOfferType) return "NONE";
    if (session.pinnedOfferType === "SERVICE" && session.pinnedServiceId) return `SERVICE:${session.pinnedServiceId}`;
    if (session.pinnedOfferType === "PRODUCT" && session.pinnedProductId) return `PRODUCT:${session.pinnedProductId}`;
    return "NONE";
  }, [session]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!liveId) return;
    setBusy("save"); setError(null);
    try {
      const next = await updateLiveSession(liveId, { title, category: category || null, playbackUrl: playbackUrl || null });
      setSession(next); setNotice("Live details saved");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save"); }
    finally { setBusy(null); }
  }

  async function start() {
    if (!liveId || !session) return;
    setError(null);

    if (session.media.nativeTransportAvailable && !mediaConnected && !session.playbackUrl) {
      setError("Connect camera + microphone first, or add a legitimate external playback URL before going Live.");
      return;
    }

    setBusy("start");
    try {
      setSession(await startLiveSession(liveId));
      setNotice("You are live");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not start Live");
    } finally {
      setBusy(null);
    }
  }

  async function end() {
    if (!liveId || !window.confirm("End this Live session?")) return;
    setBusy("end"); setError(null);
    try { setSession(await endLiveSession(liveId)); setNotice("Live ended"); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not end Live"); }
    finally { setBusy(null); }
  }

  async function changePin(value: string) {
    if (!liveId) return;
    setBusy("pin"); setError(null);
    try {
      if (value === "NONE") setSession(await pinLiveOffer(liveId, "NONE"));
      else {
        const [type, id] = value.split(":") as ["SERVICE" | "PRODUCT", string];
        setSession(await pinLiveOffer(liveId, type, id));
      }
      setNotice("Pinned offer updated");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not update pinned offer"); }
    finally { setBusy(null); }
  }

  async function sendComment(event: FormEvent) {
    event.preventDefault();
    if (!liveId || !commentBody.trim()) return;
    setBusy("comment");
    try {
      const created = await createLiveComment(liveId, commentBody);
      setComments((items) => [...items, created]);
      setCommentBody("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not comment"); }
    finally { setBusy(null); }
  }

  if (!session && !error) return <main className={styles.page}><div className={styles.shell}><section className={styles.empty}>Opening control room…</section></div></main>;

  return <main className={styles.page}>
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <a className={styles.brand} href="/live">HUSTLE LIVE · CONTROL</a>
        <div className={styles.actions}>
          {liveId && session?.status !== "DRAFT" && <a href={`/live/${liveId}`} target="_blank" rel="noreferrer">Open viewer ↗</a>}
          <a href="/live">Live directory</a>
        </div>
      </header>

      {error && <div className={styles.error}>{error}</div>}
      {notice && <div className={styles.notice}>{notice}</div>}

      {session && <>
        <section className={styles.sectionTitle}>
          <div>
            <div className={styles.eyebrow}>SESSION STATUS</div>
            <h2>{session.status === "LIVE" ? <span className={styles.liveDot}>LIVE NOW</span> : session.status}</h2>
            <div className={styles.hint}>Session ID: <code>{session.id}</code></div>
          </div>
          <div className={styles.stats}><span>{session.interactions.viewers} watching</span><span>{session.interactions.comments} comments</span></div>
        </section>

        {liveId && <NativeLiveBroadcaster
          liveId={liveId}
          status={session.status}
          available={session.media.nativeTransportAvailable}
          onConnectionChange={setMediaConnected}
        />}

        <div className={styles.controlGrid}>
          <section className={styles.panel}>
            <form className={styles.form} onSubmit={save}>
              <div className={styles.field}><label>Title</label><input maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} disabled={session.status === "ENDED"} /></div>
              <div className={styles.field}><label>Category</label><input maxLength={80} value={category} onChange={(event) => setCategory(event.target.value)} disabled={session.status === "ENDED"} /></div>
              <div className={styles.field}>
                <label>External playback URL · optional fallback</label>
                <input type="url" value={playbackUrl} onChange={(event) => setPlaybackUrl(event.target.value)} disabled={session.status === "ENDED"} placeholder="https://youtube.com/live/..." />
                <span className={styles.hint}>Native camera/microphone is now the primary transport when configured. Keep this only as a legitimate external fallback source.</span>
              </div>
              {session.status !== "ENDED" && <button className={styles.button} disabled={busy === "save"} type="submit">{busy === "save" ? "Saving…" : "Save details"}</button>}
            </form>

            <div className={styles.field} style={{marginTop:20}}>
              <label>Pin one commerce offer</label>
              <select value={selectedPin} disabled={busy === "pin" || session.status === "ENDED"} onChange={(event) => void changePin(event.target.value)}>
                <option value="NONE">No pinned offer</option>
                {services.map((service) => <option key={service.id} value={`SERVICE:${service.id}`}>Service · {service.title ?? "Untitled"}</option>)}
                {products.map((product) => <option key={product.id} value={`PRODUCT:${product.id}`}>Product · {product.title ?? "Untitled"}</option>)}
              </select>
              <span className={styles.hint}>Only your own currently published offers are eligible. Changing the pin never copies or changes the canonical Service/Product.</span>
            </div>

            <div className={styles.actions} style={{marginTop:22}}>
              {session.status === "DRAFT" && <>
                <button
                  className={`${styles.button} ${styles.primary}`}
                  disabled={busy !== null}
                  type="button"
                  onClick={() => void start()}
                >{busy === "start" ? "Starting…" : "Go Live →"}</button>
                {session.media.nativeTransportAvailable && !mediaConnected && !session.playbackUrl &&
                  <span className={styles.hint}>Connect camera + microphone first, or add an external playback URL. Draft sessions are not public until Go Live succeeds.</span>}
              </>}
              {session.status === "LIVE" && <button className={`${styles.button} ${styles.danger}`} disabled={busy !== null} type="button" onClick={() => void end()}>End Live</button>}
            </div>
          </section>

          <section className={`${styles.panel} ${styles.comments}`}>
            <div className={styles.sectionTitle} style={{marginTop:0}}><div><div className={styles.eyebrow}>LIVE CHAT</div><h2>Comments</h2></div></div>
            <div className={styles.commentList}>
              {comments.length === 0 && <p className={styles.muted}>{session.status === "LIVE" ? "Comments will appear here while you are live." : "Start the session to open live comments."}</p>}
              {comments.map((comment) => <div className={styles.comment} key={comment.id}><strong>{comment.user.displayName ?? comment.user.username ?? "Hustle user"}</strong><span>@{comment.user.username ?? "user"}</span><p>{comment.body}</p></div>)}
            </div>
            {session.status === "LIVE" && <form className={styles.commentForm} onSubmit={sendComment}><input maxLength={500} value={commentBody} onChange={(event) => setCommentBody(event.target.value)} placeholder="Reply to the room…" /><button className={styles.button} disabled={busy === "comment"}>Send</button></form>}
          </section>
        </div>
      </>}
    </div>
  </main>;
}
