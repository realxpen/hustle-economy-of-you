"use client";

import { useEffect, useState } from "react";
import { blockUser, getBlockStatus, unblockUser, type BlockStatus } from "../../lib/trust-safety";
import { SafetyReportAction } from "./safety-report-action";
import styles from "./transaction-safety-actions.module.css";

export function ConversationSafetyActions({
  conversationId,
  targetUserId,
  targetLabel
}: {
  conversationId: string;
  targetUserId: string;
  targetLabel: string;
}) {
  const [status, setStatus] = useState<BlockStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setError(null);
      setStatus(await getBlockStatus(targetUserId));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load conversation safety state");
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

  if (status?.isSelf) return null;

  return <section className={styles.card}>
    <div className={styles.heading}>
      <div>
        <small>PRIVATE · TRUST & SAFETY</small>
        <h2>Conversation safety</h2>
      </div>
      {status?.viewerBlockedTarget && <span className={styles.blockedBadge}>Blocked</span>}
    </div>
    <p className={styles.copy}>
      Report concerns from this direct conversation or block future contact. Historical messages remain available as durable interaction evidence.
    </p>
    {status?.targetBlockedViewer && <div className={styles.notice}>Direct messaging is unavailable because this user has blocked contact.</div>}
    {status?.viewerBlockedTarget && <div className={styles.notice}>You blocked {targetLabel}. New direct messages stay unavailable until you unblock them.</div>}
    {error && <div className={styles.error}>{error}</div>}
    <div className={styles.actions}>
      <SafetyReportAction
        subjectType="CONVERSATION"
        subjectId={conversationId}
        targetLabel={targetLabel}
        placeholder="Describe what happened in this conversation. Hustle can use the durable thread as interaction context."
      />
      {status && <button
        type="button"
        className={status.viewerBlockedTarget ? styles.secondary : styles.danger}
        onClick={() => void toggleBlock()}
        disabled={busy}
      >
        {status.viewerBlockedTarget ? `Unblock ${targetLabel}` : `Block ${targetLabel}`}
      </button>}
    </div>
  </section>;
}
