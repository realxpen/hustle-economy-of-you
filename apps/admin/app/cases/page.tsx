"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  addMarketplaceCaseNote,
  claimMarketplaceCase,
  createMarketplaceCase,
  getMarketplaceCase,
  getMarketplaceCaseOverview,
  getMarketplaceCaseViewer,
  listMarketplaceCases,
  releaseMarketplaceCase,
  updateMarketplaceCase,
  type MarketplaceCaseDetail,
  type MarketplaceCaseListItem,
  type MarketplaceCaseOverview,
  type MarketplaceCasePriority,
  type MarketplaceCaseStatus,
  type MarketplaceCaseSubjectType
} from "../../lib/admin-api";

const TOKEN_KEY = "hustle-admin-access-token";
const statuses: MarketplaceCaseStatus[] = [
  "OPEN", "IN_REVIEW", "WAITING_INFORMATION", "RESOLVED", "CLOSED"
];
const priorities: MarketplaceCasePriority[] = ["LOW", "NORMAL", "HIGH"];
const nextStatuses: Record<MarketplaceCaseStatus, MarketplaceCaseStatus[]> = {
  OPEN: ["IN_REVIEW"],
  IN_REVIEW: ["WAITING_INFORMATION", "RESOLVED"],
  WAITING_INFORMATION: ["IN_REVIEW"],
  RESOLVED: ["IN_REVIEW", "CLOSED"],
  CLOSED: ["IN_REVIEW"]
};

function shortDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium", timeStyle: "short"
  }).format(new Date(value)) : "—";
}

function person(value: { displayName: string | null; username: string | null } | null) {
  return value?.displayName ?? (value?.username ? `@${value.username}` : "Unassigned");
}

function price(value: number, currency: string) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency }).format(value / 100);
}

export default function CasesPage() {
  const [token, setToken] = useState("");
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [overview, setOverview] = useState<MarketplaceCaseOverview | null>(null);
  const [items, setItems] = useState<MarketplaceCaseListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [selected, setSelected] = useState<MarketplaceCaseDetail | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [subjectType, setSubjectType] = useState<MarketplaceCaseSubjectType>("BOOKING");
  const [subjectId, setSubjectId] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [priority, setPriority] = useState<MarketplaceCasePriority>("NORMAL");
  const [nextStatus, setNextStatus] = useState<MarketplaceCaseStatus | "">("");
  const [nextPriority, setNextPriority] = useState<MarketplaceCasePriority>("NORMAL");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const existing = window.sessionStorage.getItem(TOKEN_KEY) ?? "";
    const q = new URLSearchParams(window.location.search);
    const type = q.get("subjectType");
    if (type === "BOOKING" || type === "ORDER") setSubjectType(type);
    setSubjectId(q.get("subjectId") ?? "");
    setToken(existing);
    if (existing) void refresh(existing, "", "", null);
  }, []);

  async function refresh(
    t = token,
    s = statusFilter,
    sub = subjectFilter,
    cursor: string | null = null
  ) {
    if (!t) return;
    setBusy(true);
    setError(null);
    try {
      const [page, stats, viewer] = await Promise.all([
        listMarketplaceCases(t, { status: s, subjectType: sub, cursor, limit: 30 }),
        getMarketplaceCaseOverview(t),
        getMarketplaceCaseViewer(t)
      ]);
      setItems((previous) => cursor ? [...previous, ...page.items] : page.items);
      setNextCursor(page.nextCursor);
      setOverview(stats);
      setViewerId(viewer.userId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load casework");
    } finally {
      setBusy(false);
    }
  }

  async function openCase(id: string) {
    setBusy(true);
    setError(null);
    try {
      const data = await getMarketplaceCase(token, id);
      setSelected(data);
      setNextPriority(data.priority);
      setNextStatus("");
      setReason("");
      setNote("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open case");
    } finally {
      setBusy(false);
    }
  }

  async function act(fn: () => Promise<MarketplaceCaseDetail>, success: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const next = await fn();
      setSelected(next);
      setNextPriority(next.priority);
      setNextStatus("");
      setReason("");
      setNote("");
      setNotice(success);
      const [page, stats] = await Promise.all([
        listMarketplaceCases(token, { status: statusFilter, subjectType: subjectFilter }),
        getMarketplaceCaseOverview(token)
      ]);
      setItems(page.items);
      setNextCursor(page.nextCursor);
      setOverview(stats);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Case action failed");
    } finally {
      setBusy(false);
    }
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    await act(
      () => createMarketplaceCase(token, {
        subjectType, subjectId: subjectId.trim(),
        title: title.trim(), summary: summary.trim(), priority
      }),
      "Case opened. Claim it to begin investigation."
    );
  }

  async function change(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    await act(
      () => updateMarketplaceCase(token, selected.id, {
        ...(nextStatus ? { status: nextStatus } : {}),
        ...(nextPriority !== selected.priority ? { priority: nextPriority } : {}),
        reason: reason.trim()
      }),
      "Case state updated with a durable audit event."
    );
  }

  async function addNote(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    await act(
      () => addMarketplaceCaseNote(token, selected.id, note.trim()),
      "Internal evidence note recorded."
    );
  }

  if (!token) return <main className="admin-shell auth-shell">
    <section className="auth-card">
      <p className="eyebrow">HUSTLE / CASEWORK</p>
      <h1>Admin session required.</h1>
      <p>Open Marketplace Operations first and authenticate using an approved admin session.</p>
      <a className="primary" href="/">Back to operations</a>
    </section>
  </main>;

  const owns = Boolean(selected && viewerId === selected.assignedToUserId);
  const canClaim = Boolean(selected && !selected.assignedToUserId);
  const statusOptions = selected ? nextStatuses[selected.status] : [];

  return <main className="admin-shell">
    <header className="topbar">
      <div>
        <p className="eyebrow">HUSTLE / MARKETPLACE CASEWORK</p>
        <h1>Investigate. Record.<br/>Resolve responsibly.</h1>
        <p className="subtitle">
          Human-owned support cases for real Bookings and Orders. Case status does not
          alter transaction status, escrow, payouts, Reviews or reputation.
        </p>
      </div>
      <div className="top-actions">
        <a className="secondary" href="/">Operations</a>
        <a className="secondary" href="/trust-safety">Trust & Safety</a>
        <button className="secondary" disabled={busy} onClick={() => void refresh()}>Refresh</button>
      </div>
    </header>

    {error && <div className="banner error">{error}</div>}
    {notice && <div className="banner success">{notice}</div>}

    {overview && <section className="ops-metrics">
      {statuses.map((status) => <article key={status}>
        <span>{status.replaceAll("_", " ")}</span>
        <strong>{overview.byStatus[status] ?? 0}</strong>
        <small>Internal case state only</small>
      </article>)}
      <article><span>High-priority open cases</span>
        <strong>{overview.openByPriority.HIGH ?? 0}</strong>
        <small>Prioritization, not a finding of wrongdoing</small></article>
    </section>}

    <section className="ops-grid casework-layout">
      <div className="ops-card">
        <div className="card-title"><strong>Case queue</strong><span>{items.length} loaded</span></div>
        <div className="case-filters">
          <select value={statusFilter} onChange={(event) => {
            const value = event.target.value;
            setStatusFilter(value); void refresh(token, value, subjectFilter, null);
          }}>
            <option value="">All statuses</option>
            {statuses.map((status) => <option value={status} key={status}>{status}</option>)}
          </select>
          <select value={subjectFilter} onChange={(event) => {
            const value = event.target.value;
            setSubjectFilter(value); void refresh(token, statusFilter, value, null);
          }}>
            <option value="">Bookings + Orders</option>
            <option value="BOOKING">Bookings</option>
            <option value="ORDER">Orders</option>
          </select>
        </div>
        <div className="table-list">
          {items.map((item) => <button className="case-row" key={item.id}
            onClick={() => void openCase(item.id)} type="button">
            <div><strong>{item.title}</strong><small>{item.subjectType} · {item.subjectId}</small>
              <small>{person(item.assignedTo)} · {shortDate(item.updatedAt)}</small></div>
            <div><span className="pill">{item.status}</span>
              <span className="pill">{item.priority}</span></div>
          </button>)}
          {!items.length && <div className="empty">No cases match this filter.</div>}
          {nextCursor && <button className="secondary wide-action" type="button" disabled={busy}
            onClick={() => void refresh(token, statusFilter, subjectFilter, nextCursor)}>
              Load more cases
            </button>}
        </div>
      </div>

      <div className="casework-right">
        <section className="ops-card">
          <div className="card-title"><strong>Open a transaction case</strong><span className="read-only-tag">INTERNAL ONLY</span></div>
          <form onSubmit={create} className="case-form">
            <label className="field"><span>SUBJECT TYPE</span>
              <select value={subjectType} onChange={(e)=>setSubjectType(e.target.value as MarketplaceCaseSubjectType)}>
                <option value="BOOKING">Booking</option><option value="ORDER">Order</option>
              </select>
            </label>
            <label className="field"><span>BOOKING OR ORDER ID</span>
              <input required value={subjectId} onChange={(e)=>setSubjectId(e.target.value)}
                placeholder="Copy from the marketplace operations list"/></label>
            <label className="field"><span>CASE TITLE</span>
              <input required maxLength={160} value={title} onChange={(e)=>setTitle(e.target.value)}
                placeholder="Short problem description"/></label>
            <label className="field"><span>REASON FOR INVESTIGATION</span>
              <textarea required rows={3} maxLength={4000} value={summary} onChange={(e)=>setSummary(e.target.value)}
                placeholder="Describe the reported issue and what needs checking"/></label>
            <label className="field"><span>PRIORITY</span>
              <select value={priority} onChange={(e)=>setPriority(e.target.value as MarketplaceCasePriority)}>
                {priorities.map((p)=><option key={p}>{p}</option>)}
              </select>
            </label>
            <button className="primary wide-action" disabled={busy || !subjectId.trim() || !title.trim() || !summary.trim()}>
              Open case
            </button>
          </form>
        </section>

        {selected && <section className="ops-card">
          <div className="card-title"><div><p className="eyebrow">{selected.subjectType} CASE</p>
            <strong>{selected.title}</strong></div><span className="pill">{selected.status}</span></div>
          <p className="case-summary">{selected.summary}</p>
          <dl className="ops-dl">
            <div><dt>Subject</dt><dd>{selected.subjectId}</dd></div>
            <div><dt>Transaction status</dt><dd>{selected.subject.status}</dd></div>
            <div><dt>Payment status</dt><dd>{selected.subject.payment?.status ?? "No payment record"}</dd></div>
            <div><dt>Escrow status</dt><dd>{selected.subject.payment?.escrow?.status ?? "No escrow record"}</dd></div>
            <div><dt>Transaction amount</dt><dd>{price(selected.subject.agreedPriceMinor ?? selected.subject.totalMinor ?? 0, selected.subject.currency)}</dd></div>
            <div><dt>Priority</dt><dd>{selected.priority}</dd></div>
            <div><dt>Opened by</dt><dd>{person(selected.openedBy)}</dd></div>
            <div><dt>Assigned to</dt><dd>{person(selected.assignedTo)}</dd></div>
            <div><dt>Created</dt><dd>{shortDate(selected.createdAt)}</dd></div>
          </dl>
          <div className="moderation-actions">
            {canClaim && <button className="primary" type="button" disabled={busy}
              onClick={()=>void act(()=>claimMarketplaceCase(token,selected.id),"Case claimed for investigation.")}>Claim case</button>}
            {owns && <button className="secondary" type="button" disabled={busy}
              onClick={()=>void act(()=>releaseMarketplaceCase(token,selected.id),"Case released to the queue.")}>Release case</button>}
          </div>

          {owns && <>
            <form className="case-form" onSubmit={change}>
              <p className="eyebrow">UPDATE CASE STATE</p>
              <label className="field"><span>NEXT STATUS</span>
                <select value={nextStatus} onChange={(e)=>setNextStatus(e.target.value as MarketplaceCaseStatus | "")}>
                  <option value="">Leave status unchanged</option>
                  {statusOptions.map((s)=><option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label className="field"><span>PRIORITY</span>
                <select value={nextPriority} onChange={(e)=>setNextPriority(e.target.value as MarketplaceCasePriority)}>
                  {priorities.map((p)=><option key={p} value={p}>{p}</option>)}
                </select>
              </label>
              <label className="field"><span>REQUIRED REASON / EVIDENCE</span>
                <textarea rows={3} required maxLength={4000} value={reason}
                  onChange={(e)=>setReason(e.target.value)} placeholder="Why is this state change appropriate?"/></label>
              <button className="primary wide-action" disabled={busy || !reason.trim() || (!nextStatus && nextPriority===selected.priority)}>
                Save decision + audit
              </button>
            </form>
            <form className="case-form" onSubmit={addNote}>
              <p className="eyebrow">RECORD INTERNAL EVIDENCE</p>
              <label className="field"><span>NOTE</span>
                <textarea rows={3} required maxLength={4000} value={note}
                  onChange={(e)=>setNote(e.target.value)} placeholder="Observation, support contact, or investigated fact"/></label>
              <button className="secondary wide-action" disabled={busy || !note.trim()}>Add note</button>
            </form>
          </>}

          <div className="review-block">
            <p className="eyebrow">EVIDENCE + DECISION HISTORY</p>
            {selected.notes.length === 0 && <p className="case-summary">No internal notes recorded yet.</p>}
            {selected.notes.map((entry)=><article className="case-note" key={entry.id}>
              <div><strong>{person(entry.author)}</strong><time>{shortDate(entry.createdAt)}</time></div>
              <p>{entry.body}</p></article>)}
            {selected.resolution && <div className="banner success">Resolution record: {selected.resolution}</div>}
          </div>
        </section>}
      </div>
    </section>
  </main>;
}
