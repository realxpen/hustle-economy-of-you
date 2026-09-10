"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { openDirectConversation, type MessageContextType } from "../../../lib/messaging";
import styles from "../messages.module.css";

const allowedContextTypes = new Set<MessageContextType>(["POST", "SERVICE", "PRODUCT"]);

export default function StartMessagePage() {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const userId = searchParams.get("userId")?.trim();
    const rawType = searchParams.get("contextType")?.trim().toUpperCase() as MessageContextType | undefined;
    const contextId = searchParams.get("contextId")?.trim();

    if (!userId) {
      setError("A recipient is required to start a conversation.");
      return;
    }

    const contextType = rawType && allowedContextTypes.has(rawType) ? rawType : null;

    openDirectConversation(userId)
      .then(({ conversation }) => {
        const params = new URLSearchParams();
        if (contextType && contextId) {
          params.set("contextType", contextType);
          params.set("contextId", contextId);
        }
        const suffix = params.toString() ? `?${params.toString()}` : "";
        window.location.replace(`/messages/${conversation.id}${suffix}`);
      })
      .catch((reason: Error) => {
        setError(reason.message);
        if (reason.message.toLowerCase().includes("sign in")) {
          setTimeout(() => window.location.assign("/auth"), 900);
        }
      });
  }, [searchParams]);

  return <main className={styles.start}>
    <section className={styles.startCard}>
      <p className={styles.eyebrow}>HUSTLE MESSAGING</p>
      <h1>{error ? "Could not start conversation." : "Opening conversation…"}</h1>
      <p>{error ?? "Connecting this discovery context to your existing direct thread."}</p>
      {error && <a href="/messages">Go to messages →</a>}
    </section>
  </main>;
}
