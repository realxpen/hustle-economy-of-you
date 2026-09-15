"use client";

import { useEffect, useState } from "react";
import {
  blockUser,
  createTransactionSafetyReport,
  getBlockStatus,
  unblockUser,
  type BlockStatus,
  type SafetyReportCategory
} from "../../lib/trust-safety";
import type { ReviewSubjectType } from "../../lib/trust";
import styles from "./transaction-safety-actions.module.css";

const reportCategories: Array<{ value: SafetyReportCategory; label: string }> = [
  { value: "HARASSMENT", label: "Harassment" },
  { value: "FRAUD_SCAM", label: "Fraud / scam" },
  { value: "THREATS", label: "Threats" },
  { value: "FAKE_IDENTITY", label: "Fake identity" },
  { value: "PAYMENT_ABUSE", label: "Payment abuse" },
  { value: "PROHIBITED_GOODS_SERVICES", label: "Prohibited goods / services" },
  { value: "SPAM", label: "Spam" },
  { value: "OFF_PLATFORM_MANIPULATION", label: "Off-platform manipulation" },
  { value: "OTHER", label: "Other" }
];

export function TransactionSafetyActions({
  targetUserId,
  targetLabel,
  subjectType,
  subjectId,
  messageHref
}: {
  targetUserId: string;
  targetLabel: string;
  subjectType: ReviewSubjectType;
  subjectId: string;
  messageHref?: string;
}) {
  const [status, setStatus] = useState<BlockStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [category, setCategory] = useState<SafetyReportCategory>("OTHER");
  const [details, setDetails] = useState("");
  const [reportNotice, setReportNotice] = useState<string | null>(null);

  async function loadStatus() {
    try {
      setLoading(true);
      setError(null);
      setStatus(await getBlockStatus(targetUserId));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load contact safety state");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadStatus();
  }, [targetUserId]);

  async function toggleBlock() {
    if (!status || status.isSelf || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (status.viewerBlockedTarget) await unblockUser(targetUserId);
      else await blockUser(targetUserId);
      await loadStatus();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update block status");
    } finally {
      setBusy(false);
    }
  }

  async function submitReport() {
    const trimmed = details.trim();
    if (trimmed.length < 10) {
      setError("Report details must be at least 10 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    setReportNotice(null);
    try {
      await createTransactionSafetyReport({
        subjectType,
        subjectId,
        category,
        details: trimmed
      });
      setReportNotice("Report submitted privately to Hustle Trust & Safety.");
      setDetails("");
      setReportOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not submit report");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <section className={styles.card}><small>TRUST · SAFETY</small><p>Checking contact safety…</p></section>;
  }

  if (status?.isSelf) return null;

  const messagingUnavailable = status ? !status.messagingAllowed : false;

  return <section className={styles.card}>
    <div className={styles.heading}>
      <div>
        <small>TRUST · SAFETY</small>
        <h2>Safety controls</h2>
      </div>
      {status?.viewerBlockedTarget && <span className={styles.blockedBadge}>Blocked</span>}
    </div>

    <p className={styles.copy}>
      Reports are private and do not change public reputation by themselves. Blocking stops future direct messaging but keeps historical transactions and messages intact.
    </p>

    {status?.targetBlockedViewer && <div className={styles.notice}>
      Direct messaging is unavailable because this user has blocked contact.
    </div>}
    {status?.viewerBlockedTarget && <div className={styles.notice}>
      You blocked {targetLabel}. Direct messaging stays unavailable until you unblock them.
    </div>}
    {reportNotice && <div className={styles.success}>{reportNotice}</div>}
    {error && <div className={styles.error}>{error}</div>}

    <div className={styles.actions}>
      {messageHref && !messagingUnavailable && <a className={styles.primary} href={messageHref}>Message {targetLabel}</a>}
      <button type="button" className={styles.secondary} onClick={() => setReportOpen((value) => !value)} disabled={busy}>
        {reportOpen ? "Close report form" : `Report ${targetLabel}`}
      </button>
      <button type="button" className={status?.viewerBlockedTarget ? styles.secondary : styles.danger} onClick={() => void toggleBlock()} disabled={busy || !status}>
        {status?.viewerBlockedTarget ? `Unblock ${targetLabel}` : `Block ${targetLabel}`}
      </button>
    </div>

    {reportOpen && <div className={styles.reportForm}>
      <label>
        REPORT REASON
        <select value={category} onChange={(event) => setCategory(event.target.value as SafetyReportCategory)}>
          {reportCategories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </label>
      <label>
        WHAT HAPPENED?
        <textarea
          value={details}
          maxLength={2000}
          onChange={(event) => setDetails(event.target.value)}
          placeholder="Describe the issue clearly. Include only information relevant to this transaction."
        />
      </label>
      <div className={styles.formFooter}>
        <small>{details.length}/2000 · minimum 10 characters</small>
        <button type="button" className={styles.primary} onClick={() => void submitReport()} disabled={busy || details.trim().length < 10}>
          {busy ? "Submitting…" : "Submit private report"}
        </button>
      </div>
    </div>}
  </section>;
}
