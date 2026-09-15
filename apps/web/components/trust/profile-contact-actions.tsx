"use client";

import { useEffect, useState } from "react";
import { blockUser, getBlockStatus, unblockUser, type BlockStatus } from "../../lib/trust-safety";
import { SafetyReportAction } from "./safety-report-action";
import styles from "./transaction-safety-actions.module.css";

export function ProfileContactActions({
  targetUserId,
  targetLabel,
  messageHref
}: {
  targetUserId: string;
  targetLabel: string;
  messageHref: string;
}) {
  const [status, setStatus] = useState<BlockStatus | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setError(null);
      const next = await getBlockStatus(targetUserId);
      setStatus(next);
      setSignedOut(false);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Could not load contact safety state";
      if (message.toLowerCase().includes("sign in")) {
        setSignedOut(true);
        setStatus(null);
      } else {
        setError(message);
      }
    }
  }

  useEffect(() => {
    void load();
  }, [targetUserId]);

  async function toggleBlock() {
    if (!status || status.isSelf || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (status.viewerBlockedTarget) await unblockUser(targetUserId);
      else await blockUser(targetUserId);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update block status");
    } finally {
      setBusy(false);
    }
  }

  if (signedOut || (!status && !error)) {
    return <a className={styles.primary} href={messageHref}>Message →</a>;
  }
  if (status?.isSelf) return null;

  return <div className={styles.actions}>
    {status?.messagingAllowed && <a className={styles.primary} href={messageHref}>Message →</a>}
    {status && <SafetyReportAction
      subjectType="PROFILE"
      subjectId={targetUserId}
      targetLabel={targetLabel}
      placeholder="Describe the profile or account safety concern clearly."
    />}
    {status && <button
      type="button"
      className={status.viewerBlockedTarget ? styles.secondary : styles.danger}
      onClick={() => void toggleBlock()}
      disabled={busy}
    >
      {status.viewerBlockedTarget ? `Unblock ${targetLabel}` : `Block ${targetLabel}`}
    </button>}
    {status?.targetBlockedViewer && <span className={styles.notice}>Direct contact unavailable</span>}
    {error && <span className={styles.error}>{error}</span>}
  </div>;
}
