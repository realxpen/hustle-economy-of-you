"use client";

import { useEffect, useMemo, useState } from "react";
import {
  approveAgentApplication,
  getAgentProofReadUrl,
  getAgentReview,
  getAgentReviewQueue,
  rejectAgentApplication,
  setAgentVerification,
  startAgentReview,
  type AgentReviewRecord
} from "../../../lib/agent-review";
import styles from "../hustler-reviews/page.module.css";

export default function AgentReviewsPage() {
  const [queue, setQueue] = useState<AgentReviewRecord[]>([]);
  const [selected, setSelected] = useState<AgentReviewRecord | null>(null);
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
      const next = await getAgentReviewQueue();
      setQueue(next);
      const id = preferredId ?? selected?.id;
      if (id) {
        const stillVisible = next.find((item) => item.id === id);
        if (stillVisible) {
          setSelected(await getAgentReview(id));
          return;
        }
      }
      setSelected(next[0] ? await getAgentReview(next[0].id) : null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load Agent review queue");
    }
  }

  async function openApplication(applicationId: string) {
    setBusy(true);
    setError(null);
    try {
      setSelected(await getAgentReview(applicationId));
      setNotes("");
      setRejectionReason("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not open Agent application");
    } finally {
      setBusy(false);
    }
  }

  async function run(action: () => Promise<AgentReviewRecord>, success: string) {
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
      const result = await getAgentProofReadUrl(selected.id, proofId);
      window.open(result.url, "_blank", "noopener,noreferrer");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not open Agent proof");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <main className={styles.shell}><p className={styles.loading}>Loading Agent review queue…</p></main>;
  }

  return <main className={styles.shell}>
    <header className={styles.header}>
      <div><p>HUSTLE · INTERNAL AGENT REVIEW</p><h1>Representation review.</h1></div>
      <div className={styles.metrics}><strong>{pendingCount}</strong><span>waiting</span></div>
    </header>

    {error && <div className={styles.error}>{error}</div>}
    {notice && <div className={styles.notice}>{notice}</div>}

    <section className={styles.layout}>
      <aside className={styles.queue}>
        <div className={styles.queueHeader}><strong>Agent queue</strong><button onClick={() => refresh()} disabled={busy}>Refresh</button></div>
        {queue.length === 0 ? <p className={styles.empty}>No submitted or active Agent reviews.</p> : queue.map((item) => <button key={item.id} className={`${styles.queueItem} ${selected?.id === item.id ? styles.active : ""}`} onClick={() => openApplication(item.id)} disabled={busy}>
          <span>{item.user.displayName ?? item.user.username ?? item.user.email ?? "Unnamed applicant"}</span>
          <small>{item.operatingArea ?? "Operating area not set"}</small>
          <b>{item.status.replaceAll("_", " ")}</b>
        </button>)}
      </aside>

      <section className={styles.detail}>
        {!selected ? <div className={styles.emptyDetail}><h2>No Agent application selected.</h2><p>Submitted Agent applications will appear here.</p></div> : <>
          <div className={styles.identityRow}>
            <div><p>APPLICANT</p><h2>{selected.user.displayName ?? selected.user.username ?? "Hustle user"}</h2><span>@{selected.user.username ?? "username"} · {selected.user.location ?? "Location unavailable"}</span></div>
            <strong>{selected.status.replaceAll("_", " ")}</strong>
          </div>

          <div className={styles.grid}>
            <article><small>OPERATING AREA</small><h3>{selected.operatingArea ?? "—"}</h3><p>Where this Agent expects to support professionals.</p></article>
            <article><small>IDENTITY</small><h3>{selected.identityVerificationStatus.replaceAll("_", " ")}</h3><p>{selected.user.email ?? selected.user.phone ?? "No contact"}</p></article>
            <article><small>CURRENT CAPABILITIES</small><h3>{selected.user.capabilities?.filter((item) => item.status === "ACTIVE").map((item) => item.capability).join(" + ") || "CLIENT"}</h3><p>Approval adds AGENT; it does not replace existing capabilities.</p></article>
          </div>

          <article className={styles.story}><small>MOTIVATION</small><h3>Why Agent?</h3><p>{selected.motivation}</p></article>
          <article className={styles.story}><small>RELEVANT EXPERIENCE</small><h3>Representation readiness</h3><p>{selected.experienceSummary}</p></article>

          {(selected.organizationName || selected.organizationInfo) && <article className={styles.story}><small>ORGANIZATION CONTEXT</small><h3>{selected.organizationName ?? "Independent Agent"}</h3><p>{selected.organizationInfo}</p></article>}

          <article className={styles.story}>
            <small>AGENT PROOF</small>
            <div className={styles.proofs}>{selected.proofs.map((proof) => <div key={proof.id}><div><strong>{proof.fileName}</strong><span>{proof.type.replaceAll("_", " ")} · {proof.mimeType}</span></div><button onClick={() => previewProof(proof.id)} disabled={busy || selected.status !== "UNDER_REVIEW"}>Open securely ↗</button></div>)}</div>
          </article>

          {selected.status === "SUBMITTED" && <button className={styles.primary} onClick={() => run(() => startAgentReview(selected.id), "Agent review started and assigned to you.")} disabled={busy}>Start admin review</button>}

          {selected.status === "UNDER_REVIEW" && <div className={styles.reviewPanel}>
            <div className={styles.verifyRow}>
              <span>Identity verification</span>
              <button onClick={() => run(() => setAgentVerification(selected.id, "VERIFIED"), "Agent identity marked verified.")} disabled={busy}>Mark verified</button>
              <button onClick={() => run(() => setAgentVerification(selected.id, "REJECTED"), "Agent identity marked rejected.")} disabled={busy}>Mark rejected</button>
            </div>

            <label><span>Admin review notes</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} placeholder="Internal review notes and evidence considered" /></label>
            <label><span>Rejection reason</span><textarea value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} rows={3} placeholder="Required only when rejecting" /></label>

            <div className={styles.decisionRow}>
              <button className={styles.approve} onClick={() => run(() => approveAgentApplication(selected.id, notes), "AGENT capability activated on the existing identity.")} disabled={busy || selected.identityVerificationStatus !== "VERIFIED"}>Approve + activate AGENT</button>
              <button className={styles.reject} onClick={() => run(() => rejectAgentApplication(selected.id, rejectionReason, notes), "Agent application rejected.")} disabled={busy || rejectionReason.trim().length === 0}>Reject application</button>
            </div>
            <small>
              Approval is atomic and audited. It adds AGENT while preserving CLIENT/HUSTLER. It grants no Hustler delegation, profile ownership, wallet authority, reputation authority or fund access.
            </small>
          </div>}
        </>}
      </section>
    </section>
  </main>;
}
