"use client";

import { useState } from "react";
import {
  createSafetyReport,
  type SafetyReportCategory,
  type SafetyReportSubjectType
} from "../../lib/trust-safety";
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

export function SafetyReportAction({
  subjectType,
  subjectId,
  targetLabel,
  placeholder
}: {
  subjectType: SafetyReportSubjectType;
  subjectId: string;
  targetLabel: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<SafetyReportCategory>("OTHER");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit() {
    const trimmed = details.trim();
    if (trimmed.length < 10) {
      setError("Report details must be at least 10 characters.");
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await createSafetyReport({ subjectType, subjectId, category, details: trimmed });
      setNotice("Report submitted privately to Hustle Trust & Safety.");
      setDetails("");
      setOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not submit report");
    } finally {
      setBusy(false);
    }
  }

  return <>
    <button
      type="button"
      className={styles.secondary}
      onClick={() => setOpen((value) => !value)}
      disabled={busy}
    >
      {open ? "Close report form" : `Report ${targetLabel}`}
    </button>

    {notice && <span className={styles.success}>{notice}</span>}
    {error && <span className={styles.error}>{error}</span>}

    {open && <div className={styles.reportForm}>
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
          placeholder={placeholder ?? "Describe the safety issue clearly. Include only information relevant to this interaction."}
        />
      </label>
      <div className={styles.formFooter}>
        <small>{details.length}/2000 · minimum 10 characters</small>
        <button
          type="button"
          className={styles.primary}
          onClick={() => void submit()}
          disabled={busy || details.trim().length < 10}
        >
          {busy ? "Submitting…" : "Submit private report"}
        </button>
      </div>
    </div>}
  </>;
}
