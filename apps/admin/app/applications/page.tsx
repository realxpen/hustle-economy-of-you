"use client";

import { useEffect, useState } from "react";
import {
  approveAgentAdminApplication,
  approveHustlerAdminApplication,
  getAdminApplicationQueues,
  getAgentAdminProofReadUrl,
  getAgentAdminReview,
  getHustlerAdminProofReadUrl,
  getHustlerAdminReview,
  rejectAgentAdminApplication,
  rejectHustlerAdminApplication,
  setAgentAdminVerification,
  setHustlerAdminVerification,
  startAgentAdminReview,
  startHustlerAdminReview,
  type AdminApplicationQueues,
  type AdminReviewRecord
} from "../../lib/admin-api";

const TOKEN_KEY = "hustle-admin-access-token";

type Kind = "HUSTLER" | "AGENT";

function displayName(user: { displayName: string | null; username: string | null }) {
  return user.displayName ?? (user.username ? `@${user.username}` : "Hustle user");
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export default function ApplicationsOperationsPage() {
  const [token, setToken] = useState("");
  const [queues, setQueues] = useState<AdminApplicationQueues | null>(null);
  const [kind, setKind] = useState<Kind | null>(null);
  const [selected, setSelected] = useState<AdminReviewRecord | null>(null);
  const [notes, setNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const existing = window.sessionStorage.getItem(TOKEN_KEY) ?? "";
    setToken(existing);
    if (existing) void loadQueues(existing);
  }, []);

  async function loadQueues(nextToken = token) {
    if (!nextToken) return;
    setBusy(true);
    setError(null);
    try {
      setQueues(await getAdminApplicationQueues(nextToken, 100));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load application queues");
    } finally {
      setBusy(false);
    }
  }

  async function openApplication(nextKind: Kind, applicationId: string) {
    if (!token) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    setKind(nextKind);
    try {
      const record = nextKind === "HUSTLER"
        ? await getHustlerAdminReview(token, applicationId)
        : await getAgentAdminReview(token, applicationId);
      setSelected(record);
      setNotes(record.reviewNotes ?? "");
      setRejectionReason(record.rejectionReason ?? "");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load application");
    } finally {
      setBusy(false);
    }
  }

  async function refreshSelected() {
    if (!selected || !kind) return;
    await openApplication(kind, selected.id);
    await loadQueues();
  }

  async function run(action: () => Promise<AdminReviewRecord>, message: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const record = await action();
      setSelected(record);
      setNotes(record.reviewNotes ?? notes);
      setNotice(message);
      await loadQueues();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Application review action failed");
    } finally {
      setBusy(false);
    }
  }

  async function previewProof(proofId: string) {
    if (!selected || !kind || !token) return;

    const proofWindow = window.open("", "_blank");
    if (proofWindow) {
      proofWindow.opener = null;
      proofWindow.document.title = "Opening secure proof…";
      proofWindow.document.body.innerHTML =
        "<p style='font-family:system-ui;padding:24px'>Opening secure proof…</p>";
    }

    setBusy(true);
    setError(null);
    try {
      const result = kind === "HUSTLER"
        ? await getHustlerAdminProofReadUrl(token, selected.id, proofId)
        : await getAgentAdminProofReadUrl(token, selected.id, proofId);

      if (proofWindow) proofWindow.location.replace(result.url);
      else window.location.assign(result.url);
    } catch (reason) {
      proofWindow?.close();
      setError(reason instanceof Error ? reason.message : "Could not open secure proof");
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return <main className="admin-shell auth-shell">
      <section className="auth-card">
        <p className="eyebrow">HUSTLE / APPLICATION OPERATIONS</p>
        <h1>Admin session required.</h1>
        <p>Open Marketplace Operations first and store the authorized admin session for this tab.</p>
        <a className="primary" href="/">Back to operations</a>
      </section>
    </main>;
  }

  return <main className="admin-shell">
    <header className="topbar">
      <div>
        <p className="eyebrow">HUSTLE / CAPABILITY OPERATIONS</p>
        <h1>Review people,<br/>activate capability.</h1>
        <p className="subtitle">
          Hustler and Agent review now share the standalone admin console.
          API rules still prevent self-review and require verified identity + proof before approval.
        </p>
      </div>
      <div className="top-actions">
        <a className="secondary" href="/">Operations</a>
        <a className="secondary" href="/trust-safety">Trust & Safety</a>
        <button className="secondary" onClick={() => void loadQueues()} disabled={busy}>Refresh</button>
      </div>
    </header>

    {error && <div className="banner error">{error}</div>}
    {notice && <div className="banner success">{notice}</div>}

    <section className="ops-grid applications-grid">
      <div className="ops-card">
        <div className="card-title"><strong>Review queue</strong><span>{(queues?.hustler.length ?? 0) + (queues?.agent.length ?? 0)}</span></div>
        <div className="application-groups">
          <div>
            <p className="eyebrow">HUSTLER</p>
            <div className="table-list">
              {queues?.hustler.map((item) => <button className="user-row" type="button" key={item.id} onClick={() => void openApplication("HUSTLER", item.id)}>
                <div><strong>{displayName(item.user)}</strong><small>{item.primarySkill ?? "Skill not set"} · {formatDate(item.submittedAt)}</small></div>
                <span className="pill">{item.status}</span>
              </button>)}
              {!queues?.hustler.length && <div className="empty">No Hustler applications waiting.</div>}
            </div>
          </div>

          <div>
            <p className="eyebrow">AGENT</p>
            <div className="table-list">
              {queues?.agent.map((item) => <button className="user-row" type="button" key={item.id} onClick={() => void openApplication("AGENT", item.id)}>
                <div><strong>{displayName(item.user)}</strong><small>{item.operatingArea ?? "Area not set"} · {formatDate(item.submittedAt)}</small></div>
                <span className="pill">{item.status}</span>
              </button>)}
              {!queues?.agent.length && <div className="empty">No Agent applications waiting.</div>}
            </div>
          </div>
        </div>
      </div>

      <aside className="ops-card application-detail">
        {!selected || !kind ? <div className="empty">Select an application to review.</div> : <>
          <div className="card-title">
            <div><p className="eyebrow">{kind} APPLICATION</p><strong>{displayName(selected.user)}</strong></div>
            <span className="pill">{selected.status}</span>
          </div>

          <dl className="ops-dl">
            <div><dt>Username</dt><dd>@{selected.user.username ?? "user"}</dd></div>
            <div><dt>Contact</dt><dd>{selected.user.email ?? selected.user.phone ?? "—"}</dd></div>
            <div><dt>Location</dt><dd>{selected.user.location ?? "—"}</dd></div>
            <div><dt>Verification</dt><dd>{selected.identityVerificationStatus}</dd></div>
            {kind === "HUSTLER" && <><div><dt>Primary skill</dt><dd>{selected.primarySkill ?? "—"}</dd></div><div><dt>Category</dt><dd>{selected.category ?? "—"}</dd></div><div><dt>Experience</dt><dd>{selected.experienceSummary ?? "—"}</dd></div></>}
            {kind === "AGENT" && <><div><dt>Operating area</dt><dd>{selected.operatingArea ?? "—"}</dd></div><div><dt>Organization</dt><dd>{selected.organizationName ?? "—"}</dd></div><div><dt>Motivation</dt><dd>{selected.motivation ?? "—"}</dd></div></>}
          </dl>

          {selected.user.assistedRegistration && <div className="banner success">
            Agent-assisted registration · {selected.user.assistedRegistration.agent.displayName ?? selected.user.assistedRegistration.agent.username ?? "Agent"} · {selected.user.assistedRegistration.consentMethod}
          </div>}

          <section className="review-block">
            <p className="eyebrow">PRIVATE PROOF</p>
            <div className="table-list">
              {selected.proofs.map((proof) => <div className="finance-row" key={proof.id}>
                <div><strong>{proof.fileName}</strong><small>{proof.type} · {proof.mimeType}</small></div>
                <button className="secondary" type="button" disabled={busy || selected.status !== "UNDER_REVIEW"} onClick={() => void previewProof(proof.id)}>Open securely ↗</button>
              </div>)}
              {!selected.proofs.length && <div className="empty">No proof attached.</div>}
            </div>
          </section>

          {selected.status === "SUBMITTED" && <button className="primary wide-action" disabled={busy} onClick={() => void run(
            () => kind === "HUSTLER" ? startHustlerAdminReview(token, selected.id) : startAgentAdminReview(token, selected.id),
            "Review started."
          )}>Start review</button>}

          {selected.status === "UNDER_REVIEW" && <>
            <section className="review-block">
              <p className="eyebrow">IDENTITY VERIFICATION</p>
              <div className="moderation-actions">
                <button className="primary" disabled={busy} onClick={() => void run(
                  () => kind === "HUSTLER" ? setHustlerAdminVerification(token, selected.id, "VERIFIED") : setAgentAdminVerification(token, selected.id, "VERIFIED"),
                  "Identity marked VERIFIED."
                )}>Mark verified</button>
                <button className="secondary" disabled={busy} onClick={() => void run(
                  () => kind === "HUSTLER" ? setHustlerAdminVerification(token, selected.id, "REJECTED") : setAgentAdminVerification(token, selected.id, "REJECTED"),
                  "Identity verification rejected."
                )}>Reject verification</button>
              </div>
            </section>

            <label className="field">
              <span>ADMIN NOTES</span>
              <textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Internal review context" />
            </label>

            <div className="moderation-actions">
              <button className="primary" disabled={busy || selected.identityVerificationStatus !== "VERIFIED" || selected.proofs.length === 0} onClick={() => void run(
                () => kind === "HUSTLER" ? approveHustlerAdminApplication(token, selected.id, notes) : approveAgentAdminApplication(token, selected.id, notes),
                `${kind} capability approved and activated.`
              )}>Approve + activate {kind}</button>
            </div>

            <label className="field">
              <span>REJECTION REASON</span>
              <textarea rows={3} value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} placeholder="Required only when rejecting" />
            </label>
            <button className="danger wide-action" disabled={busy || !rejectionReason.trim()} onClick={() => void run(
              () => kind === "HUSTLER" ? rejectHustlerAdminApplication(token, selected.id, rejectionReason, notes) : rejectAgentAdminApplication(token, selected.id, rejectionReason, notes),
              `${kind} application rejected.`
            )}>Reject application</button>
          </>}

          {(selected.status === "APPROVED" || selected.status === "REJECTED") && <div className="banner success">Decision recorded. {selected.reviewNotes ?? selected.rejectionReason ?? ""}</div>}

          <button className="link-button" type="button" disabled={busy} onClick={() => void refreshSelected()}>Refresh selected application →</button>
        </>}
      </aside>
    </section>
  </main>;
}
