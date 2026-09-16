"use client";

import { useEffect, useMemo, useState } from "react";
import { listGivenReviews, type ReviewRecord } from "../../lib/trust";
import {
  listMyBlocks,
  listMyCounterpartyFeedback,
  listMySafetyReports,
  unblockUser,
  type CounterpartyFeedbackRecord,
  type SafetyReportRecord,
  type UserBlockRecord
} from "../../lib/trust-safety";
import { ReviewCard } from "./review-card";
import styles from "./trust-activity-center.module.css";

type TrustTab = "REVIEWS" | "FEEDBACK" | "REPORTS" | "BLOCKS";

const tabs: Array<{ value: TrustTab; label: string }> = [
  { value: "REVIEWS", label: "Public reviews" },
  { value: "FEEDBACK", label: "Private feedback" },
  { value: "REPORTS", label: "Reports" },
  { value: "BLOCKS", label: "Blocked users" }
];

function userLabel(user: { displayName: string | null; username: string | null }) {
  return user.displayName ?? (user.username ? `@${user.username}` : "Hustle user");
}

function pretty(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
}

function date(value: string) {
  return new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(new Date(value));
}

export function TrustActivityCenter() {
  const [tab, setTab] = useState<TrustTab>("REVIEWS");
  const [reviews, setReviews] = useState<ReviewRecord[]>([]);
  const [feedback, setFeedback] = useState<CounterpartyFeedbackRecord[]>([]);
  const [reports, setReports] = useState<SafetyReportRecord[]>([]);
  const [blocks, setBlocks] = useState<UserBlockRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyBlockId, setBusyBlockId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [reviewResult, feedbackResult, reportResult, blockResult] = await Promise.all([
        listGivenReviews(12),
        listMyCounterpartyFeedback(),
        listMySafetyReports(),
        listMyBlocks()
      ]);
      setReviews(reviewResult.items.filter((review) => review.status === "PUBLISHED"));
      setFeedback(feedbackResult);
      setReports(reportResult);
      setBlocks(blockResult);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load your trust activity");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const counts = useMemo(() => ({
    REVIEWS: reviews.length,
    FEEDBACK: feedback.length,
    REPORTS: reports.length,
    BLOCKS: blocks.length
  }), [blocks.length, feedback.length, reports.length, reviews.length]);

  async function unblock(record: UserBlockRecord) {
    if (busyBlockId) return;
    setBusyBlockId(record.blockedUserId);
    setError(null);
    try {
      await unblockUser(record.blockedUserId);
      setBlocks((current) => current.filter((item) => item.blockedUserId !== record.blockedUserId));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not unblock this user");
    } finally {
      setBusyBlockId(null);
    }
  }

  return <section className={styles.shell} aria-live="polite">
    <div className={styles.header}>
      <div>
        <small>YOUR TRUST ACTIVITY</small>
        <h2>Public proof and private safety, kept separate.</h2>
        <p>Verified reviews contribute to provider reputation. Private feedback, reports and blocks support safety operations and do not directly change public reputation.</p>
      </div>
      <button type="button" className={styles.refresh} onClick={() => void load()} disabled={loading}>Refresh</button>
    </div>

    <div className={styles.boundaries}>
      <article>
        <span className={styles.publicBadge}>PUBLIC</span>
        <strong>Verified provider reviews</strong>
        <p>Transaction-backed reviews you publish are visible as provider reputation evidence.</p>
      </article>
      <article>
        <span className={styles.privateBadge}>PRIVATE</span>
        <strong>Trust & Safety activity</strong>
        <p>Counterparty feedback, reports and blocks stay out of public UserReputation.</p>
      </article>
      <article>
        <span className={styles.adminBadge}>ADMIN ONLY</span>
        <strong>Moderation intelligence</strong>
        <p>Admin evidence and moderation notes are never exposed in this user-facing surface.</p>
      </article>
    </div>

    <div className={styles.tabs} role="tablist" aria-label="Trust activity">
      {tabs.map((item) => <button
        key={item.value}
        type="button"
        role="tab"
        aria-selected={tab === item.value}
        className={tab === item.value ? styles.tabActive : styles.tab}
        onClick={() => setTab(item.value)}
      >
        <span>{item.label}</span>
        <b>{counts[item.value]}</b>
      </button>)}
    </div>

    {loading && <div className={styles.state}>Loading trust activity…</div>}
    {error && <div className={styles.error}><strong>Trust activity needs attention</strong><p>{error}</p></div>}

    {!loading && tab === "REVIEWS" && <div className={styles.panel} role="tabpanel">
      <div className={styles.panelHeading}>
        <div><small>TRUST · REVIEW</small><h3>Reviews you’ve given</h3></div>
        <span>Public after verified transaction</span>
      </div>
      {reviews.length === 0 ? <div className={styles.empty}>You have not published a verified transaction review yet.</div> : <div className={styles.reviewList}>
        {reviews.map((review) => <ReviewCard key={review.id} review={review} perspective="given" />)}
      </div>}
    </div>}

    {!loading && tab === "FEEDBACK" && <div className={styles.panel} role="tabpanel">
      <div className={styles.panelHeading}>
        <div><small>PRIVATE · TRUST & SAFETY</small><h3>Counterparty feedback you’ve given</h3></div>
        <span>Never public reputation</span>
      </div>
      {feedback.length === 0 ? <div className={styles.empty}>You have not submitted private counterparty feedback yet.</div> : <div className={styles.activityList}>
        {feedback.map((item) => <article className={styles.activityCard} key={item.id}>
          <div className={styles.activityTop}>
            <div><strong>{userLabel(item.target)}</strong><span>{item.subjectType} · {pretty(item.transactionStatusSnapshot)}</span></div>
            <span className={item.wouldWorkAgain ? styles.positive : styles.caution}>{item.wouldWorkAgain ? "Would work again" : "Would not work again"}</span>
          </div>
          {item.experienceRating && <div className={styles.stars} aria-label={`${item.experienceRating} out of 5 private experience rating`}>{"★".repeat(item.experienceRating)}{"☆".repeat(5 - item.experienceRating)}</div>}
          {item.issueCategories.length > 0 && <div className={styles.chips}>{item.issueCategories.map((issue) => <span key={issue}>{pretty(issue)}</span>)}</div>}
          {item.privateNote && <p className={styles.privateNote}>{item.privateNote}</p>}
          <small>Private · submitted {date(item.createdAt)}</small>
        </article>)}
      </div>}
    </div>}

    {!loading && tab === "REPORTS" && <div className={styles.panel} role="tabpanel">
      <div className={styles.panelHeading}>
        <div><small>PRIVATE REPORTS</small><h3>Reports you’ve submitted</h3></div>
        <span>Human moderation lifecycle</span>
      </div>
      {reports.length === 0 ? <div className={styles.empty}>You have not submitted a safety report.</div> : <div className={styles.activityList}>
        {reports.map((report) => <article className={styles.activityCard} key={report.id}>
          <div className={styles.activityTop}>
            <div><strong>{userLabel(report.target)}</strong><span>{report.subjectType} · {pretty(report.category)}</span></div>
            <span className={styles.status} data-status={report.status}>{pretty(report.status)}</span>
          </div>
          <p>{report.details}</p>
          <small>Submitted {date(report.createdAt)}{report.resolvedAt ? ` · resolved ${date(report.resolvedAt)}` : ""}</small>
        </article>)}
      </div>}
    </div>}

    {!loading && tab === "BLOCKS" && <div className={styles.panel} role="tabpanel">
      <div className={styles.panelHeading}>
        <div><small>CONTACT SAFETY</small><h3>Users you’ve blocked</h3></div>
        <span>Historical evidence is preserved</span>
      </div>
      {blocks.length === 0 ? <div className={styles.empty}>You have no active blocks.</div> : <div className={styles.activityList}>
        {blocks.map((record) => <article className={styles.blockCard} key={record.blockedUserId}>
          <div>
            <strong>{userLabel(record.blocked)}</strong>
            <span>{record.blocked.username ? `@${record.blocked.username}` : "Hustle user"} · blocked {date(record.createdAt)}</span>
          </div>
          <button type="button" onClick={() => void unblock(record)} disabled={Boolean(busyBlockId)}>
            {busyBlockId === record.blockedUserId ? "Unblocking…" : "Unblock"}
          </button>
        </article>)}
      </div>}
      <p className={styles.blockNote}>Unblocking restores the possibility of direct contact. It does not delete previous messages, transactions or reports.</p>
    </div>}
  </section>;
}
