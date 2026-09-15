"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getSafetyOverview,
  getUserSafetySummary,
  listSafetyReports,
  updateSafetyReport,
  type AdminSafetyOverview,
  type SafetyReport,
  type SafetyStatus,
  type UserSafetySummary
} from "../lib/admin-api";

const TOKEN_KEY = "hustle-admin-access-token";

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function displayName(user: { displayName: string | null; username: string | null }) {
  return user.displayName ?? (user.username ? `@${user.username}` : "Hustle user");
}

export default function AdminHome() {
  const [token, setToken] = useState("");
  const [tokenDraft, setTokenDraft] = useState("");
  const [overview, setOverview] = useState<AdminSafetyOverview | null>(null);
  const [reports, setReports] = useState<SafetyReport[]>([]);
  const [statusFilter, setStatusFilter] = useState<SafetyStatus | "ALL">("ALL");
  const [selectedUser, setSelectedUser] = useState<UserSafetySummary | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const existing = window.sessionStorage.getItem(TOKEN_KEY) ?? "";
    setToken(existing);
    setTokenDraft(existing);
  }, []);

  async function load(nextToken = token, nextFilter = statusFilter) {
    if (!nextToken) return;
    setLoading(true);
    setError(null);
    try {
      const [nextOverview, nextReports] = await Promise.all([
        getSafetyOverview(nextToken),
        listSafetyReports(nextToken, nextFilter === "ALL" ? undefined : nextFilter)
      ]);
      setOverview(nextOverview);
      setReports(nextReports);
      if (selectedUserId) {
        setSelectedUser(await getUserSafetySummary(nextToken, selectedUserId));
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load Trust & Safety intelligence");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token) void load(token, statusFilter);
  }, [token, statusFilter]);

  function saveToken() {
    const next = tokenDraft.trim();
    if (!next) return;
    window.sessionStorage.setItem(TOKEN_KEY, next);
    setToken(next);
    setNotice("Admin session stored only for this browser tab session.");
  }

  function clearToken() {
    window.sessionStorage.removeItem(TOKEN_KEY);
    setToken("");
    setTokenDraft("");
    setOverview(null);
    setReports([]);
    setSelectedUser(null);
    setSelectedUserId(null);
  }

  async function inspectUser(userId: string) {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      setSelectedUserId(userId);
      setSelectedUser(await getUserSafetySummary(token, userId));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load user safety summary");
    } finally {
      setLoading(false);
    }
  }

  async function changeReport(report: SafetyReport, status: SafetyStatus) {
    if (!token) return;
    const note = (notes[report.id] ?? report.moderationNote ?? "").trim();
    if ((status === "ACTIONED" || status === "DISMISSED") && !note) {
      setError("Add a moderation note before actioning or dismissing a report.");
      return;
    }
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      await updateSafetyReport(token, report.id, { status, ...(note ? { moderationNote: note } : {}) });
      setNotice(`Report ${report.id} moved to ${status.replace("_", " ")}.`);
      await load(token, statusFilter);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update report");
    } finally {
      setLoading(false);
    }
  }

  const reviewCount = useMemo(
    () => reports.filter((report) => report.status === "OPEN" || report.status === "UNDER_REVIEW").length,
    [reports]
  );

  if (!token) {
    return <main className="admin-shell auth-shell">
      <section className="auth-card">
        <p className="eyebrow">HUSTLE / INTERNAL</p>
        <h1>Trust & Safety Console</h1>
        <p>
          This internal MVP console never stores the bearer token in the repository or sends it anywhere except the Hustle API. The token remains in this tab&apos;s session storage.
        </p>
        <label className="field">
          <span>ADMIN ACCESS TOKEN</span>
          <textarea
            rows={5}
            value={tokenDraft}
            onChange={(event) => setTokenDraft(event.target.value)}
            placeholder="Paste the current authenticated admin bearer token"
          />
        </label>
        <button className="primary" type="button" onClick={saveToken} disabled={!tokenDraft.trim()}>
          Open internal console
        </button>
      </section>
    </main>;
  }

  return <main className="admin-shell">
    <header className="topbar">
      <div>
        <p className="eyebrow">HUSTLE / INTERNAL</p>
        <h1>Trust & Safety Intelligence</h1>
        <p className="subtitle">Explainable evidence for human moderation. No automatic punishment from one subjective complaint.</p>
      </div>
      <div className="top-actions">
        <button className="secondary" type="button" onClick={() => void load()} disabled={loading}>Refresh</button>
        <button className="danger" type="button" onClick={clearToken}>End session</button>
      </div>
    </header>

    {error && <div className="banner error">{error}</div>}
    {notice && <div className="banner success">{notice}</div>}

    {overview && <section className="metrics">
      <article><span>Open</span><strong>{overview.reports.open}</strong></article>
      <article><span>Under review</span><strong>{overview.reports.underReview}</strong></article>
      <article><span>Actioned</span><strong>{overview.reports.actioned}</strong></article>
      <article><span>Dismissed</span><strong>{overview.reports.dismissed}</strong></article>
      <article><span>Private feedback</span><strong>{overview.privateFeedbackCount}</strong></article>
      <article><span>Active blocks</span><strong>{overview.activeBlockRelationships}</strong></article>
    </section>}

    <section className="workspace">
      <div className="queue-column">
        <div className="section-head">
          <div>
            <p className="eyebrow">MODERATION QUEUE</p>
            <h2>{reviewCount} unresolved in this view</h2>
          </div>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as SafetyStatus | "ALL")}>
            <option value="ALL">All reports</option>
            <option value="OPEN">Open</option>
            <option value="UNDER_REVIEW">Under review</option>
            <option value="ACTIONED">Actioned</option>
            <option value="DISMISSED">Dismissed</option>
          </select>
        </div>

        <div className="report-list">
          {reports.map((report) => <article className="report-card" key={report.id}>
            <div className="report-top">
              <span className={`status status-${report.status.toLowerCase()}`}>{report.status.replace("_", " ")}</span>
              <span>{report.subjectType} · {report.category.replaceAll("_", " ")}</span>
            </div>
            <h3>{displayName(report.target)}</h3>
            <p>{report.details}</p>
            <div className="report-meta">
              <span>Reporter: {displayName(report.reporter)}</span>
              <span>{formatDate(report.createdAt)}</span>
            </div>
            <button className="link-button" type="button" onClick={() => void inspectUser(report.targetUserId)}>
              Inspect target evidence →
            </button>
            <label className="field compact">
              <span>MODERATION NOTE</span>
              <textarea
                rows={2}
                value={notes[report.id] ?? report.moderationNote ?? ""}
                onChange={(event) => setNotes((current) => ({ ...current, [report.id]: event.target.value }))}
                placeholder="Evidence reviewed, reasoning, or action taken"
              />
            </label>
            <div className="moderation-actions">
              <button className="secondary" type="button" disabled={loading} onClick={() => void changeReport(report, "UNDER_REVIEW")}>Review</button>
              <button className="primary" type="button" disabled={loading} onClick={() => void changeReport(report, "ACTIONED")}>Action</button>
              <button className="secondary" type="button" disabled={loading} onClick={() => void changeReport(report, "DISMISSED")}>Dismiss</button>
            </div>
          </article>)}
          {!reports.length && <div className="empty">No reports match this filter.</div>}
        </div>
      </div>

      <aside className="intelligence-column">
        <p className="eyebrow">USER SAFETY SUMMARY</p>
        {!selectedUser && <div className="empty">Choose “Inspect target evidence” to review corroborating signals.</div>}
        {selectedUser && <UserSummary summary={selectedUser} />}
      </aside>
    </section>
  </main>;
}

function UserSummary({ summary }: { summary: UserSafetySummary }) {
  const user = summary.user;
  return <div className="summary-stack">
    <section className="summary-card strong-card">
      <h2>{displayName(user)}</h2>
      <p>@{user.username ?? "unknown"}</p>
      <span className={`assessment ${summary.assessment === "REVIEW_RECOMMENDED" ? "review" : "neutral"}`}>
        {summary.assessment.replaceAll("_", " ")}
      </span>
      <p className="policy-copy">{summary.policy.statement}</p>
    </section>

    <section className="summary-card grid-summary">
      <div><span>Reports</span><strong>{summary.reports.total}</strong></div>
      <div><span>Independent reporters</span><strong>{summary.reports.uniqueReporters}</strong></div>
      <div><span>Private feedback</span><strong>{summary.privateFeedback.total}</strong></div>
      <div><span>Would not work again</span><strong>{summary.privateFeedback.wouldNotWorkAgain}</strong></div>
      <div><span>Blocks received</span><strong>{summary.platformEvidence.blocksReceived}</strong></div>
      <div><span>Private experience avg.</span><strong>{summary.privateFeedback.averageExperienceRating ?? "—"}</strong></div>
    </section>

    <section className="summary-card">
      <h3>Explainable indicators</h3>
      {!summary.indicators.length && <p>No established multi-signal pattern.</p>}
      {summary.indicators.map((indicator) => <div className="indicator" key={indicator.code}>
        <span>{indicator.level}</span>
        <strong>{indicator.label}</strong>
        <p>{indicator.explanation}</p>
        <code>{JSON.stringify(indicator.evidence)}</code>
      </div>)}
    </section>

    <section className="summary-card">
      <h3>Authoritative transaction evidence</h3>
      <dl>
        <div><dt>Bookings</dt><dd>{summary.platformEvidence.bookings.total}</dd></div>
        <div><dt>Cancelled by user</dt><dd>{summary.platformEvidence.bookings.cancelledByUser}</dd></div>
        <div><dt>Booking disputes</dt><dd>{summary.platformEvidence.bookings.disputed}</dd></div>
        <div><dt>Booking refunds</dt><dd>{summary.platformEvidence.bookings.refunded}</dd></div>
        <div><dt>Orders as buyer</dt><dd>{summary.platformEvidence.orders.asBuyer}</dd></div>
        <div><dt>Buyer refunds</dt><dd>{summary.platformEvidence.orders.buyerRefunded}</dd></div>
      </dl>
    </section>

    <section className="summary-card">
      <h3>Private feedback issues</h3>
      <pre>{JSON.stringify(summary.privateFeedback.issueCounts, null, 2)}</pre>
    </section>
  </div>;
}
