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
    setBusy(true);
    setError(null);
    try {
      const session = await createLiveSession({
        title,
        category: category || null,
        playbackUrl: playbackUrl || null
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
          <h1 style={{fontSize:"clamp(42px,6vw,72px)",lineHeight:.95,letterSpacing:"-.055em",margin:"10px 0 18px"}}>Turn demonstration into <em style={{fontStyle:"normal",color:"#b6ff5f"}}>opportunity.</em></h1>
          <p className={styles.muted}>Only an approved Hustler with a published professional profile can host commerce Live. Viewers can still be any Hustle User—or signed-out visitors when watching.</p>
          <div className={styles.transportNote} style={{marginTop:20}}><strong>17A media boundary:</strong> Hustle is not pretending a placeholder is a broadcast. You may optionally provide a real public playback URL now. Native camera/microphone broadcast transport is the next Live slice.</div>
        </div>

        <section className={styles.panel}>
          <form className={styles.form} onSubmit={submit}>
            {error && <div className={styles.error}>{error}</div>}
            <div className={styles.field}>
              <label htmlFor="title">Live title</label>
              <input id="title" maxLength={120} required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Building a landing page from scratch" />
            </div>
            <div className={styles.field}>
              <label htmlFor="category">Category</label>
              <input id="category" maxLength={80} value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Technology" />
            </div>
            <div className={styles.field}>
              <label htmlFor="playback">External playback URL · optional</label>
              <input id="playback" type="url" value={playbackUrl} onChange={(event) => setPlaybackUrl(event.target.value)} placeholder="https://youtube.com/live/..." />
              <span className={styles.hint}>Useful for a legitimate existing YouTube Live or browser-playable stream while native Hustle broadcast transport is still being integrated.</span>
            </div>
            <button className={`${styles.button} ${styles.primary}`} disabled={busy} type="submit">{busy ? "Creating…" : "Create control room →"}</button>
          </form>
        </section>
      </section>
    </div>
  </main>;
}
