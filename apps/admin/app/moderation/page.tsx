"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  applyModerationHold,
  getModerationDetail,
  getModerationOverview,
  listModerationContent,
  releaseModerationHold,
  type ModerationContent,
  type ModerationDetail,
  type ModerationOverview,
  type ModerationState,
  type ModerationSubjectType
} from "../../lib/admin-api";

const TOKEN_KEY = "hustle-admin-access-token";
const TYPES: ModerationSubjectType[] = ["POST", "SERVICE", "PRODUCT"];

function person(value: { displayName: string | null; username: string | null }) {
  return value.displayName ?? (value.username ? `@${value.username}` : "Hustle user");
}
function timestamp(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium", timeStyle: "short"
  }).format(new Date(value));
}

export default function ModerationPage() {
  const [token, setToken] = useState("");
  const [type, setType] = useState<ModerationSubjectType>("POST");
  const [state, setState] = useState<ModerationState | "">("");
  const [contentId, setContentId] = useState("");
  const [items, setItems] = useState<ModerationContent[]>([]);
  const [selected, setSelected] = useState<ModerationDetail | null>(null);
  const [overview, setOverview] = useState<ModerationOverview | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const stored = window.sessionStorage.getItem(TOKEN_KEY) ?? "";
    setToken(stored);
    const q = new URLSearchParams(window.location.search);
    const qType = q.get("type");
    const nextType = TYPES.includes(qType as ModerationSubjectType)
      ? qType as ModerationSubjectType : "POST";
    setType(nextType);
    setContentId(q.get("id") ?? "");
    if (stored) void load(stored, nextType, "");
  }, []);

  async function load(t = token, nextType = type, nextState = state) {
    if (!t) return;
    setBusy(true);
    setError(null);
    try {
      const [rows, stats] = await Promise.all([
        listModerationContent(t, nextType, nextState, 50),
        getModerationOverview(t)
      ]);
      setItems(rows);
      setOverview(stats);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Failed to load moderation records");
    } finally {
      setBusy(false);
    }
  }

  async function inspect(id: string, nextType = type) {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const detail = await getModerationDetail(token, nextType, id);
      setSelected(detail);
      setType(nextType);
      setContentId(id);
      setReason("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Failed to find this content");
    } finally {
      setBusy(false);
    }
  }

  async function act(event: FormEvent) {
    event.preventDefault();
    if (!selected || !reason.trim()) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const next = selected.subject.moderationState === "HELD"
        ? await releaseModerationHold(token, selected.subjectType, selected.subject.id, reason.trim())
        : await applyModerationHold(token, selected.subjectType, selected.subject.id, reason.trim());
      setSelected(next);
      setReason("");
      setNotice(next.subject.moderationState === "HELD"
        ? "Content held and removed from public discovery. Publication is blocked."
        : "Hold released. The owner must explicitly republish; nothing was restored automatically.");
      const [rows, stats] = await Promise.all([
        listModerationContent(token, type, state, 50),
        getModerationOverview(token)
      ]);
      setItems(rows);
      setOverview(stats);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Moderation action failed");
    } finally {
      setBusy(false);
    }
  }

  if (!token) return <main className="admin-shell auth-shell">
    <section className="auth-card">
      <p className="eyebrow">HUSTLE / CONTENT MODERATION</p>
      <h1>Admin session required.</h1>
      <p>Sign into Marketplace Operations first to access this internal moderation console.</p>
      <a className="primary" href="/">Back to operations</a>
    </section>
  </main>;

  return <main className="admin-shell">
    <header className="topbar">
      <div>
        <p className="eyebrow">HUSTLE / CONTENT ENFORCEMENT</p>
        <h1>Moderate with evidence.<br/>Release with accountability.</h1>
        <p className="subtitle">
          Human-controlled visibility holds for Posts, Services and Products.
          Holding content does not ban its owner, refund customers, release escrow or change reviews.
        </p>
      </div>
      <div className="top-actions">
        <a className="secondary" href="/">Operations</a>
        <a className="secondary" href="/trust-safety">Trust & Safety</a>
        <button className="secondary" disabled={busy} onClick={() => void load()}>Refresh</button>
      </div>
    </header>

    {error && <div className="banner error">{error}</div>}
    {notice && <div className="banner success">{notice}</div>}

    {overview && <section className="ops-metrics">
      {TYPES.map((entry) => <article key={entry}>
        <span>{entry} under hold</span>
        <strong>{overview.holds[entry] ?? 0}</strong>
        <small>Not publicly discoverable</small>
      </article>)}
      <article>
        <span>Recent enforcement actions</span>
        <strong>{overview.recent.length}</strong>
        <small>Latest 20 actions, including releases</small>
      </article>
    </section>}

    <section className="ops-grid two">
      <div className="ops-card">
        <div className="card-title"><strong>Content queue</strong><span>Latest {items.length}</span></div>
        <div className="case-filters">
          <select value={type} onChange={(event) => {
            const next = event.target.value as ModerationSubjectType;
            setType(next); setSelected(null); void load(token, next, state);
          }}>
            {TYPES.map((option) => <option key={option}>{option}</option>)}
          </select>
          <select value={state} onChange={(event) => {
            const next = event.target.value as ModerationState | "";
            setState(next); void load(token, type, next);
          }}>
            <option value="">All content states</option>
            <option value="CLEAR">Clear</option>
            <option value="HELD">Held</option>
          </select>
        </div>
        <form className="ops-search" onSubmit={(event) => {
          event.preventDefault();
          if (contentId.trim()) void inspect(contentId.trim());
        }}>
          <input value={contentId} onChange={(event)=>setContentId(event.target.value)}
            placeholder="Exact Post, Service or Product ID"/>
          <button className="secondary" disabled={busy || !contentId.trim()}>Inspect</button>
        </form>
        <div className="table-list">
          {items.map((item) => <button type="button" key={item.id} className="case-row"
            onClick={() => void inspect(item.id)}>
            <div><strong>{item.title}</strong><small>{person(item.owner)}</small>
              <small>{item.id}</small></div>
            <div><span className="pill">{item.status}</span>
              <span className="pill">{item.moderationState}</span></div>
          </button>)}
          {!items.length && <div className="empty">No matching content in this list.</div>}
        </div>
      </div>

      <div className="ops-card">
        {!selected ? <div className="empty">
          Choose an item or inspect an exact ID to examine its moderation state and action history.
        </div> : <>
          <div className="card-title"><div>
            <p className="eyebrow">{selected.subjectType} / MODERATION</p>
            <strong>{selected.subject.title}</strong>
          </div><span className="pill">{selected.subject.moderationState}</span></div>
          <dl className="ops-dl">
            <div><dt>Owner</dt><dd>{person(selected.subject.owner)}</dd></div>
            <div><dt>Owner ID</dt><dd>{selected.subject.ownerUserId}</dd></div>
            <div><dt>Content ID</dt><dd>{selected.subject.id}</dd></div>
            <div><dt>Publication status</dt><dd>{selected.subject.status}</dd></div>
            <div><dt>Moderation state</dt><dd>{selected.subject.moderationState}</dd></div>
          </dl>
          <form className="case-form" onSubmit={(e) => void act(e)}>
            <p className="eyebrow">
              {selected.subject.moderationState === "HELD" ? "RELEASE CONTENT HOLD" : "PLACE CONTENT HOLD"}
            </p>
            <p className="policy-copy">
              {selected.subject.moderationState === "HELD"
                ? "Releasing clears the restriction but does not republish. The owner decides whether to publish again."
                : "Holding makes the item non-public and prevents its owner or Agent from republishing or deleting it while held."}
            </p>
            <label className="field"><span>REQUIRED EVIDENCE / REASON</span>
              <textarea rows={4} value={reason} maxLength={2000} required
                onChange={(e)=>setReason(e.target.value)} placeholder="Explain the evidence and moderation decision"/>
            </label>
            <button disabled={busy || !reason.trim()} className={selected.subject.moderationState === "HELD" ? "primary wide-action" : "danger wide-action"}>
              {selected.subject.moderationState === "HELD" ? "Release hold" : "Hold content"}
            </button>
          </form>
          <section className="review-block">
            <p className="eyebrow">MODERATION HISTORY</p>
            {!selected.history.length && <p className="case-summary">No enforcement actions recorded for this item.</p>}
            {selected.history.map((action) => <article className="case-note" key={action.id}>
              <div><strong>{action.action} · {person(action.actor)}</strong><time>{timestamp(action.createdAt)}</time></div>
              <p>{action.reason}</p>
              <small>{action.previousStatus} → {action.resultingStatus}</small>
            </article>)}
          </section>
        </>}
      </div>
    </section>
  </main>;
}
