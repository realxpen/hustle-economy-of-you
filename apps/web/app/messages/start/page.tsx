"use client";

import { useEffect, useState } from "react";
import { safeTransactionReturnTo, transactionReturnLabel } from "../../../lib/transaction-return";
import { openDirectConversation, type MessageContextType } from "../../../lib/messaging";
import styles from "../messages.module.css";

const allowedContextTypes = new Set<MessageContextType>(["POST", "SERVICE", "PRODUCT"]);

export default function StartMessagePage() {
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [returnTo, setReturnTo] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let authTimeout: ReturnType<typeof setTimeout> | null = null;
    setError(null);
    const params = new URLSearchParams(window.location.search);
    const userId = params.get("userId")?.trim();
    const rawType = params.get("contextType")?.trim().toUpperCase() as MessageContextType | undefined;
    const contextId = params.get("contextId")?.trim();
    const safeReturn = safeTransactionReturnTo(params.get("returnTo"));
    setReturnTo(safeReturn);

    if (!userId) {
      setError("A recipient is required to start a conversation.");
      return () => { active = false; };
    }

    const contextType = rawType && allowedContextTypes.has(rawType) ? rawType : null;
    void openDirectConversation(userId)
      .then(({ conversation }) => {
        if (!active) return;
        const nextParams = new URLSearchParams();
        if (contextType && contextId) {
          nextParams.set("contextType", contextType);
          nextParams.set("contextId", contextId);
        }
        if (safeReturn) nextParams.set("returnTo", safeReturn);
        const suffix = nextParams.toString() ? `?${nextParams.toString()}` : "";
        window.location.replace(`/messages/${encodeURIComponent(conversation.id)}${suffix}`);
      })
      .catch((reason: Error) => {
        if (!active) return;
        setError(reason.message);
        if (reason.message.toLowerCase().includes("sign in")) {
          authTimeout = setTimeout(() => window.location.assign("/auth"), 900);
        }
      });
    return () => { active = false; if (authTimeout) clearTimeout(authTimeout); };
  }, [retry]);

  return <main className={styles.start}>
    <section className={styles.startCard}>
      <p className={styles.eyebrow}>HUSTLE MESSAGING</p>
      <h1>{error ? "Could not start conversation." : "Opening conversation…"}</h1>
      <p>{error ?? "Connecting this discovery context to your existing direct thread."}</p>
      {error && <div className={styles.startActions}>
        <button type="button" onClick={() => setRetry((count) => count + 1)}>Try again</button>
        <a href="/messages">Go to messages →</a>
      </div>}
      {returnTo && <a className={styles.transactionReturn} href={returnTo}>{transactionReturnLabel(returnTo)} ↗</a>}
    </section>
  </main>;
}
