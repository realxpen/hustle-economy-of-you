"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import {
  getEligibleAppeals,
  getMyEnforcementAppeals,
  submitEnforcementAppeal,
  type EligibleAppealTarget,
  type EnforcementAppeal,
  type EnforcementAppealActionType
} from "../../lib/enforcement-appeals";
import styles from "../agents/page.module.css";

function label(value: string) {
  return value.replaceAll("_", " ");
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export default function EnforcementAppealsPage() {
  const [eligible, setEligible] = useState<EligibleAppealTarget[]>([]);
  const [appeals, setAppeals] = useState<EnforcementAppeal[]>([]);
  const [selected, setSelected] = useState<EligibleAppealTarget | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    setBusy(true);
    setError(null);
    try {
      const [targets, history] = await Promise.all([
        getEligibleAppeals(),
        getMyEnforcementAppeals()
      ]);
      setEligible([...targets.content, ...targets.capability]);
      setAppeals(history);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load appeal options");
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!selected || !reason.trim()) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await submitEnforcementAppeal(
        selected.actionType as EnforcementAppealActionType,
        selected.enforcementRef,
        reason.trim()
      );
      setSelected(null);
      setReason("");
      setNotice("Appeal submitted. A different admin must review the original enforcement decision.");
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not submit appeal");
    } finally {
      setBusy(false);
    }
  }

  const openCount = useMemo(
    () => appeals.filter((item) => item.status === "SUBMITTED" || item.status === "UNDER_REVIEW").length,
    [appeals]
  );

  return <main className={styles.shell}>
    <header className={styles.topbar}>
      <a href="/account">← Account</a>
      <span>ENFORCEMENT APPEALS</span>
    </header>

    <section className={styles.hero}>
      <div>
        <p className={styles.eyebrow}>REVIEW WITHOUT ERASING HISTORY</p>
        <h1>Challenge a restriction.<br/><em>Keep the audit trail.</em></h1>
      </div>
      <p>
        You can appeal a current content hold or a suspended Hustler/Agent capability.
        Appeals do not alter payments, escrow, payouts, Reviews or reputation.
      </p>
    </section>

    {error && <p className={styles.error}>{error}</p>}
    {notice && <p className={styles.notice}>{notice}</p>}

    <section className={styles.boundary}>
      <strong>{openCount} appeal{openCount === 1 ? "" : "s"} currently awaiting a final decision.</strong>
      <p>
        Each enforcement event can be appealed once. The admin who made the original decision
        is not allowed to review that appeal.
      </p>
    </section>

    <section className={styles.workspaceSection}>
      <div className={styles.sectionHeading}>
        <span>01</span>
        <div><strong>Appealable restrictions</strong><p>Only restrictions that are still active appear here.</p></div>
      </div>

      {eligible.length === 0 && <div className={styles.empty}>
        <strong>No active restriction is currently eligible for appeal.</strong>
      </div>}

      {eligible.map((item) => <article className={styles.card} key={item.enforcementRef}>
        <div className={styles.cardHead}>
          <div className={styles.party}>
            <strong>{item.label}</strong>
            <span>{label(item.actionType)} · {label(item.targetKind)}</span>
          </div>
          <span>{formatDate(item.enforcedAt)}</span>
        </div>
        <p>{item.enforcementReason}</p>
        <div className={styles.actions}>
          <span>
            Original decision by {item.originalActor.displayName ?? item.originalActor.username ?? "Hustle admin"}
          </span>
          {item.existingAppeal
            ? <span className={styles.secondary}>Appeal {label(item.existingAppeal.status)}</span>
            : <button className={styles.primary} type="button" disabled={busy}
                onClick={() => { setSelected(item); setReason(""); }}>
                Appeal this decision
              </button>}
        </div>
      </article>)}

      {selected && <form className={styles.card} onSubmit={submit}>
        <div className={styles.cardHead}>
          <strong>Appeal: {selected.label}</strong>
          <button className={styles.secondary} type="button" onClick={() => setSelected(null)}>Cancel</button>
        </div>
        <label className={styles.field}>
          <span>Why should this enforcement be reconsidered?</span>
          <textarea
            rows={6}
            maxLength={4000}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Explain what you believe was incorrect, incomplete, or has changed. Include useful context."
          />
        </label>
        <button className={styles.primary} disabled={busy || !reason.trim()}>
          {busy ? "Submitting…" : "Submit appeal"}
        </button>
      </form>}
    </section>

    <section className={styles.workspaceSection}>
      <div className={styles.sectionHeading}>
        <span>02</span>
        <div><strong>Your appeal history</strong><p>Original enforcement records stay preserved even if an appeal is overturned.</p></div>
      </div>

      {appeals.length === 0 && <div className={styles.empty}><strong>No appeals submitted yet.</strong></div>}

      {appeals.map((appeal) => <article className={styles.card} key={appeal.id}>
        <div className={styles.cardHead}>
          <div className={styles.party}>
            <strong>{label(appeal.targetKind)}</strong>
            <span>{label(appeal.actionType)} · submitted {formatDate(appeal.submittedAt)}</span>
          </div>
          <span>{label(appeal.status)}</span>
        </div>
        <p>{appeal.reason}</p>
        {appeal.decision && <div className={styles.boundary}>
          <strong>Decision: {label(appeal.decision)}</strong>
          <p>{appeal.decisionReason ?? "No decision explanation recorded."}</p>
        </div>}
        <div className={styles.actions}>
          <span>{appeal.reviewer ? `Reviewer: ${appeal.reviewer.displayName ?? appeal.reviewer.username ?? "Admin"}` : "Independent reviewer not assigned yet"}</span>
          <span>{appeal.closedAt ? `Closed ${formatDate(appeal.closedAt)}` : appeal.decidedAt ? `Decided ${formatDate(appeal.decidedAt)}` : ""}</span>
        </div>
      </article>)}
    </section>
  </main>;
}
