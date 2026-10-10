"use client";

import { FormEvent, useState } from "react";

import { createLiveSession } from "../../../lib/live";
import styles from "../live.module.css";

export default function CreateLivePage() {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [playbackUrl, setPlaybackUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const session = await createLiveSession({
        title: title.trim(),
        category: category.trim() || null,
        playbackUrl: playbackUrl.trim() || null
      });
      window.location.assign(`/live/${session.id}/control`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create Live session");
    } finally {
      setBusy(false);
    }
  }

  return <main className={styles.page}>
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <a className={styles.brand} href="/live">HUSTLE LIVE</a>
        <div className={styles.actions}><a href="/live">Browse Live</a></div>
      </header>

      <section className={styles.controlGrid}>
        <div className={styles.heroPanel}>
          <div className={styles.eyebrow}>HOST A LIVE</div>
          <h1 style={{fontSize:"clamp(42px,6vw,72px)",lineHeight:.95,letterSpacing:"-.055em",margin:"10px 0 18px"}}>Turn demonstration into <em style={{fontStyle:"normal",color:"var(--h-orange, #ff5a1f)"}}>opportunity.</em></h1>
          <p className={styles.muted}>Only an approved Hustler with a published professional profile can host commerce Live. Viewers can still be any Hustle User—or signed-out visitors when watching.</p>
          <div className={styles.transportNote} style={{marginTop:20}}><strong>Before you go live:</strong> Creating a control room does not start broadcasting. You choose when to connect your camera and microphone. An external playback URL is only an optional fallback.</div>
        </div>

        <section className={styles.panel}>
          <form className={styles.form} onSubmit={submit} aria-busy={busy}>
            {error && <div className={styles.error} role="alert">{error}</div>}
            <div className={styles.field}>
              <label htmlFor="title">Live title</label>
              <input id="title" maxLength={120} required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Building a landing page from scratch" aria-describedby="live-title-hint" />
              <span className={styles.hint} id="live-title-hint">{title.length}/120 characters · Describe the skill being demonstrated.</span>
            </div>
            <div className={styles.field}>
              <label htmlFor="category">Category</label>
              <input id="category" maxLength={80} value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Technology" />
            </div>
            <div className={styles.field}>
              <label htmlFor="playback">External playback URL · optional</label>
              <input id="playback" type="url" inputMode="url" autoComplete="url" value={playbackUrl} onChange={(event) => setPlaybackUrl(event.target.value)} placeholder="https://youtube.com/live/..." />
              <span className={styles.hint}>Optional fallback only. Native Hustle camera/microphone publishing is configured from the control room when LiveKit transport is available.</span>
            </div>
            <button className={`${styles.button} ${styles.primary}`} disabled={busy || !title.trim()} type="submit">{busy ? "Creating…" : "Create control room →"}</button>
          </form>
        </section>
      </section>
    </div>
  </main>;
}
