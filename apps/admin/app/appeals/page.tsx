"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  claimAdminEnforcementAppeal,
  closeAdminEnforcementAppeal,
  decideAdminEnforcementAppeal,
  getAdminEnforcementAppeal,
  getEnforcementAppealOverview,
  listAdminEnforcementAppeals,
  type AdminEnforcementAppeal,
  type AdminEnforcementAppealDetail,
  type EnforcementAppealDecision,
  type EnforcementAppealOverview,
  type EnforcementAppealStatus
} from "../../lib/admin-api";

const TOKEN_KEY = "hustle-admin-access-token";
const statuses: EnforcementAppealStatus[] = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "DECIDED",
  "CLOSED"
];

function label(value: string) {
  return value.replaceAll("_", " ");
}

function date(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function person(value: {
  displayName: string | null;
  username: string | null;
} | null) {
  return value?.displayName ?? (value?.username ? `@${value.username}` : "Unassigned");
}

export default function EnforcementAppealsAdminPage() {
  const [token, setToken] = useState("");
  const [overview, setOverview] = useState<EnforcementAppealOverview | null>(null);
  const [items, setItems] = useState<AdminEnforcementAppeal[]>([]);
  const [selected, setSelected] = useState<AdminEnforcementAppealDetail | null>(null);
  const [status, setStatus] = useState("");
  const [decision, setDecision] = useState<EnforcementAppealDecision>("UPHELD");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const stored = window.sessionStorage.getItem(TOKEN_KEY) ?? "";
    setToken(stored);
    if (stored) void refresh(stored, "");
  }, []);

  async function refresh(nextToken = token, nextStatus = status) {
    if (!nextToken) return;
    setBusy(true);
    setError(null);
    try {
      const [list, stats] = await Promise.all([
        listAdminEnforcementAppeals(nextToken, nextStatus, 100),
        getEnforcementAppealOverview(nextToken)
      ]);
      setItems(list);
      setOverview(stats);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load appeal queue");
    } finally {
      setBusy(false);
    }
  }

  async function inspect(id: string) {
    setBusy(true);
    setError(null);
    try {
      const detail = await getAdminEnforcementAppeal(token, id);
      setSelected(detail);
      setReason("");
      setDecision("UPHELD");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load appeal");
    } finally {
      setBusy(false);
    }
  }

  async function act(
    action: () => Promise<AdminEnforcementAppealDetail>,
    success: string
  ) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const detail = await action();
      setSelected(detail);
      setNotice(success);
      setReason("");
      const [list, stats] = await Promise.all([
        listAdminEnforcementAppeals(token, status, 100),
        getEnforcementAppealOverview(token)
      ]);
      setItems(list);
      setOverview(stats);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Appeal operation failed");
    } finally {
      setBusy(false);
    }
  }

  async function decide(event: FormEvent) {
    event.preventDefault();
    if (!selected || !reason.trim()) return;
    await act(
      () => decideAdminEnforcementAppeal(
        token,
        selected.id,
        decision,
        reason.trim()
      ),
      decision === "OVERTURNED"
        ? "Appeal overturned. The specific current restriction was restored through its controlled release path."
        : "Original enforcement upheld. The restriction remains unchanged."
    );
  }

  if (!token) return <main className="admin-shell auth-shell">
    <section className="auth-card">
      <p className="eyebrow">HUSTLE / APPEALS</p>
      <h1>Admin session required.</h1>
      <p>Open Marketplace Operations first and authenticate with an approved admin session.</p>
      <a className="primary" href="/">Back to operations</a>
    </section>
  </main>;

  return <main className="admin-shell">
    <header className="topbar">
      <div>
        <p className="eyebrow">HUSTLE / ENFORCEMENT APPEALS</p>
        <h1>Review the decision.<br/>Preserve the history.</h1>
        <p className="subtitle">
          Appeals challenge a specific content hold or capability suspension.
          The original enforcing admin cannot review their own action.
        </p>
      </div>
      <div className="top-actions">
        <a className="secondary" href="/">Operations</a>
        <a className="secondary" href="/moderation">Moderation</a>
        <a className="secondary" href="/trust-safety">Trust & Safety</a>
        <button className="secondary" disabled={busy} onClick={() => void refresh()}>Refresh</button>
      </div>
    </header>

    {error && <div className="banner error">{error}</div>}
    {notice && <div className="banner success">{notice}</div>}

    {overview && <section className="ops-metrics">
      {statuses.map((entry) => <article key={entry}>
        <span>{label(entry)}</span>
        <strong>{overview.byStatus[entry] ?? 0}</strong>
        <small>Appeal workflow state</small>
      </article>)}
    </section>}

    <section className="ops-grid appeals-layout">
      <div className="ops-card">
        <div className="card-title">
          <strong>Appeal queue</strong>
          <select value={status} onChange={(event) => {
            const next = event.target.value;
            setStatus(next);
            setSelected(null);
            void refresh(token, next);
          }}>
            <option value="">All statuses</option>
            {statuses.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
          </select>
        </div>

        <div className="table-list">
          {items.map((appeal) => <button
            className="case-row"
            type="button"
            key={appeal.id}
            onClick={() => void inspect(appeal.id)}
          >
            <div>
              <strong>{label(appeal.targetKind)}</strong>
              <small>{label(appeal.actionType)} · {person(appeal.appellant)}</small>
              <small>Original admin: {person(appeal.originalActor)} · {date(appeal.submittedAt)}</small>
            </div>
            <div>
              <span className="pill">{appeal.status}</span>
              {appeal.decision && <span className="pill">{appeal.decision}</span>}
            </div>
          </button>)}
          {!items.length && <div className="empty">No appeals match this queue.</div>}
        </div>
      </div>

      <div className="ops-card">
        {!selected ? <div className="empty">
          Select an appeal to compare the appellant's reason with the original enforcement record.
        </div> : <>
          <div className="card-title">
            <div>
              <p className="eyebrow">{label(selected.actionType)}</p>
              <strong>{label(selected.targetKind)}</strong>
            </div>
            <span className="pill">{selected.status}</span>
          </div>

          <dl className="ops-dl">
            <div><dt>Appellant</dt><dd>{person(selected.appellant)}</dd></div>
            <div><dt>Original enforcing admin</dt><dd>{person(selected.originalActor)}</dd></div>
            <div><dt>Assigned reviewer</dt><dd>{person(selected.reviewer)}</dd></div>
            <div><dt>Target ID</dt><dd>{selected.targetId}</dd></div>
            <div><dt>Restriction now</dt><dd>{selected.enforcement?.currentState ?? "Unavailable"}</dd></div>
            <div><dt>Submitted</dt><dd>{date(selected.submittedAt)}</dd></div>
          </dl>

          <section className="review-block">
            <p className="eyebrow">ORIGINAL ENFORCEMENT</p>
            <div className="banner error">
              <strong>{selected.enforcement?.action ?? label(selected.actionType)}</strong>
              <p>{selected.enforcement?.reason ?? "Original enforcement reason unavailable."}</p>
            </div>
          </section>

          <section className="review-block">
            <p className="eyebrow">APPELLANT'S ARGUMENT</p>
            <p className="case-summary">{selected.reason}</p>
          </section>

          {selected.status === "SUBMITTED" && <div className="review-block">
            <p className="policy-copy">
              Claiming this appeal is blocked server-side if you made the original enforcement decision
              or if you are the appellant.
            </p>
            <button className="primary wide-action" disabled={busy}
              onClick={() => void act(
                () => claimAdminEnforcementAppeal(token, selected.id),
                "Appeal assigned for independent review."
              )}>
              Claim independent review
            </button>
          </div>}

          {selected.status === "UNDER_REVIEW" && <form className="case-form" onSubmit={decide}>
            <p className="eyebrow">FINAL APPEAL DECISION</p>
            <label className="field">
              <span>DECISION</span>
              <select value={decision} onChange={(event) => setDecision(event.target.value as EnforcementAppealDecision)}>
                <option value="UPHELD">UPHOLD ORIGINAL ENFORCEMENT</option>
                <option value="OVERTURNED">OVERTURN ORIGINAL ENFORCEMENT</option>
              </select>
            </label>
            <label className="field">
              <span>REQUIRED DECISION REASON</span>
              <textarea
                rows={5}
                maxLength={4000}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Explain the evidence and why the original enforcement should remain or be overturned."
              />
            </label>
            <div className="banner success">
              {decision === "OVERTURNED"
                ? "Overturn restores only the exact appealed restriction. Content will not auto-publish; capability restoration uses the existing reactivation path."
                : "Upholding records the appeal decision without changing the current restriction."}
            </div>
            <button className={decision === "OVERTURNED" ? "primary wide-action" : "secondary wide-action"}
              disabled={busy || !reason.trim()}>
              Record {decision}
            </button>
          </form>}

          {(selected.status === "DECIDED" || selected.status === "CLOSED") && <section className="review-block">
            <p className="eyebrow">DECISION</p>
            <div className="banner success">
              <strong>{selected.decision ? label(selected.decision) : "Decision unavailable"}</strong>
              <p>{selected.decisionReason ?? "No decision reason recorded."}</p>
            </div>
            {selected.status === "DECIDED" && <button className="secondary wide-action" disabled={busy}
              onClick={() => void act(
                () => closeAdminEnforcementAppeal(token, selected.id),
                "Appeal closed. Audit history remains preserved."
              )}>
              Close appeal
            </button>}
          </section>}

          <section className="review-block">
            <p className="policy-copy">
              Appeal decisions do not change Bookings, Orders, payments, escrow, payouts,
              Reviews or public reputation.
            </p>
          </section>
        </>}
      </div>
    </section>
  </main>;
}
