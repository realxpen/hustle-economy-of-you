"use client";

import { useEffect, useMemo, useState } from "react";
import {
  approveHustlerApplication,
  getHustlerProofReadUrl,
  getHustlerReview,
  getHustlerReviewQueue,
  rejectHustlerApplication,
  setHustlerVerification,
  startHustlerReview,
  type HustlerReviewRecord
} from "../../../lib/hustler-review";
import styles from "./page.module.css";

export default function HustlerReviewsPage() {
  const [queue, setQueue] = useState<HustlerReviewRecord[]>([]);
  const [selected, setSelected] = useState<HustlerReviewRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  const pendingCount = useMemo(
    () => queue.filter((item) => item.status === "SUBMITTED").length,
    [queue]
  );

  async function refresh(preferredId?: string) {
    setError(null);
    try {
      const next = await getHustlerReviewQueue();
      setQueue(next);
      const id = preferredId ?? selected?.id;
      if (id) {
        const stillVisible = next.find((item) => item.id === id);
        if (stillVisible) {
          setSelected(await getHustlerReview(id));
          return;
        }
      }
      setSelected(next[0] ? await getHustlerReview(next[0].id) : null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load review queue");
    }
  }

  async function openApplication(applicationId: string) {
    setBusy(true);
    setError(null);
    try {
      setSelected(await getHustlerReview(applicationId));
      setNotes("");
      setRejectionReason("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not open application");
    } finally {
      setBusy(false);
    }
  }

  async function run(action: () => Promise<HustlerReviewRecord>, success: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await action();
      setSelected(result);
      setNotice(success);
      await refresh(result.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Review action failed");
    } finally {
      setBusy(false);
    }
  }

  async function previewProof(proofId: string) {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const result = await getHustlerProofReadUrl(selected.id, proofId);
      window.open(result.url, "_blank", "noopener,noreferrer");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not open proof");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <main className={styles.shell}><p className={styles.loading}>Loading Hustler review queue…</p></main>;
  }

  return <main className={styles.shell}>
    <header className={styles.header}>
      <div><p>HUSTLE · INTERNAL REVIEW</p><h1>Capability review.</h1></div>
      <div className={styles.metrics}><strong>{pendingCount}</strong><span>waiting</span></div>
    </header>

    {error && <div className={styles.error}>{error}</div>}
    {notice && <div className={styles.notice}>{notice}</div>}

    <section className={styles.layout}>
      <aside className={styles.queue}>
        <div className={styles.queueHeader}><strong>Review queue</strong><button onClick={() => refresh()} disabled={busy}>Refresh</button></div>
        {queue.length === 0 ? <p className={styles.empty}>No submitted or active reviews.</p> : queue.map((item) => <button key={item.id} className={`${styles.queueItem} ${selected?.id === item.id ? styles.active : ""}`} onClick={() => openApplication(item.id)} disabled={busy}>
          <span>{item.user.displayName ?? item.user.username ?? item.user.email ?? "Unnamed applicant"}</span>
          <small>{item.primarySkill ?? "Skill not set"}</small>
          <b>{item.status.replaceAll("_", " ")}</b>
        </button>)}
      </aside>

      <section className={styles.detail}>
        {!selected ? <div className={styles.emptyDetail}><h2>No application selected.</h2><p>Submitted applications will appear here.</p></div> : <>
          <div className={styles.identityRow}>
            <div><p>APPLICANT</p><h2>{selected.user.displayName ?? selected.user.username ?? "Hustle user"}</h2><span>@{selected.user.username ?? "username"} · {selected.user.location ?? "Location unavailable"}</span></div>
            <strong>{selected.status.replaceAll("_", " ")}</strong>
          </div>

          <div className={styles.grid}>
            <article><small>PRIMARY SKILL</small><h3>{selected.primarySkill}</h3><p>{selected.category}</p></article>
            <article><small>EXPERIENCE</small><h3>{selected.yearsExperience ?? 0} yrs</h3><p>{selected.experienceSummary}</p></article>
            <article><small>IDENTITY</small><h3>{selected.identityVerificationStatus.replaceAll("_", " ")}</h3><p>{selected.user.email ?? selected.user.phone ?? "No contact"}</p></article>
          </div>

          {(selected.businessName || selected.businessInfo) && <article className={styles.story}><small>BUSINESS CONTEXT</small><h3>{selected.businessName ?? "Independent"}</h3><p>{selected.businessInfo}</p></article>}

          <article className={styles.story}>
            <small>CAPABILITY PROOF</small>
            <div className={styles.proofs}>{selected.proofs.map((proof) => <div key={proof.id}><div><strong>{proof.fileName}</strong><span>{proof.type.replaceAll("_", " ")} · {proof.mimeType}</span></div><button onClick={() => previewProof(proof.id)} disabled={busy || selected.status !== "UNDER_REVIEW"}>Open securely ↗</button></div>)}</div>
          </article>

          {selected.status === "SUBMITTED" && <button className={styles.primary} onClick={() => run(() => startHustlerReview(selected.id), "Review started and assigned to you.")} disabled={busy}>Start review</button>}

          {selected.status === "UNDER_REVIEW" && <div className={styles.reviewPanel}>
            <div className={styles.verifyRow}>
              <span>Identity verification</span>
              <button onClick={() => run(() => setHustlerVerification(selected.id, "VERIFIED"), "Identity marked verified.")} disabled={busy}>Mark verified</button>
              <button onClick={() => run(() => setHustlerVerification(selected.id, "REJECTED"), "Identity marked rejected.")} disabled={busy}>Mark rejected</button>
            </div>

            <label><span>Reviewer notes</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} placeholder="Internal review notes" /></label>
            <label><span>Rejection reason</span><textarea value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} rows={3} placeholder="Required only when rejecting" /></label>

            <div className={styles.decisionRow}>
              <button className={styles.approve} onClick={() => run(() => approveHustlerApplication(selected.id, notes), "Hustler capability activated on the existing identity.")} disabled={busy || selected.identityVerificationStatus !== "VERIFIED"}>Approve + activate HUSTLER</button>
              <button className={styles.reject} onClick={() => run(() => rejectHustlerApplication(selected.id, rejectionReason, notes), "Application rejected.")} disabled={busy || rejectionReason.trim().length === 0}>Reject application</button>
            </div>
            <small>Approval is atomic: the application becomes APPROVED and HUSTLER becomes ACTIVE while CLIENT remains untouched.</small>
          </div>}
        </>}
      </section>
    </section>
  </main>;
}
