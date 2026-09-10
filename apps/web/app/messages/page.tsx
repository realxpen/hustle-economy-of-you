"use client";

import { useEffect, useState } from "react";
import {
  listConversations,
  type ConversationPage,
  type ConversationSummary
} from "../../lib/messaging";
import styles from "./messages.module.css";

function formatTime(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function preview(conversation: ConversationSummary) {
  const message = conversation.lastMessage;
  if (!message) return "Start the conversation.";
  if (message.text) return message.text;
  if (message.context) return `${message.context.type.toLowerCase()} shared`;
  if (message.attachment) return `${message.attachment.type.toLowerCase()} attachment`;
  return "New message";
}

export default function MessagesPage() {
  const [items, setItems] = useState<ConversationSummary[]>([]);
  const [meta, setMeta] = useState<Pick<ConversationPage, "nextCursor" | "hasMore">>({
    nextCursor: null,
    hasMore: false
  });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(cursor: string | null = null, append = false) {
    append ? setLoadingMore(true) : setLoading(true);
    setError(null);
    try {
      const page = await listConversations({ cursor, limit: 20 });
      setItems((current) => append ? [...current, ...page.items] : page.items);
      setMeta({ nextCursor: page.nextCursor, hasMore: page.hasMore });
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Could not load messages";
      setError(message);
      if (message.toLowerCase().includes("sign in")) {
        setTimeout(() => window.location.assign("/auth"), 900);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return <main className={styles.shell}>
    <header className={styles.header}>
      <a href="/" className={styles.brand}>HUSTLE↗</a>
      <nav className={styles.nav}>
        <a href="/home">Home</a>
        <a href="/search">Search</a>
        <a href="/marketplace">Marketplace</a>
        <a href="/account">Your identity</a>
      </nav>
    </header>

    <section className={styles.hero}>
      <p className={styles.eyebrow}>DIRECT MESSAGING</p>
      <h1>Keep opportunity context in the conversation.</h1>
      <p>Messages belong to the same Hustle identity. A client can move from discovery into a direct thread without creating a separate buyer or seller inbox.</p>
    </section>

    {error && <section className={styles.error}><strong>Inbox unavailable.</strong><p>{error}</p></section>}
    {!error && loading && <section className={styles.loading}>Loading your conversations…</section>}
    {!error && !loading && items.length === 0 && <section className={styles.empty}>
      <strong>No conversations yet.</strong>
      <p>Open a professional profile, Post, Service or Product and choose Message to start a direct thread.</p>
      <a href="/home">Discover people on Hustle →</a>
    </section>}

    {items.length > 0 && <section className={styles.inbox}>
      {items.map((conversation) => {
        const other = conversation.otherParticipant;
        const initial = (other?.displayName ?? other?.username ?? "H").charAt(0).toUpperCase();
        return <a key={conversation.id} className={styles.conversation} href={`/messages/${conversation.id}`}>
          <div className={styles.avatar}>{other?.avatarUrl ? <img src={other.avatarUrl} alt="" /> : initial}</div>
          <div className={styles.conversationMain}>
            <div className={styles.nameLine}>
              <strong>{other?.displayName ?? other?.username ?? "Hustle user"}</strong>
              {other?.verified && <span className={styles.verified}>VERIFIED</span>}
            </div>
            <small>@{other?.username ?? "user"}{other?.professionalProfile?.primarySkill ? ` · ${other.professionalProfile.primarySkill}` : ""}</small>
            <p className={styles.preview}>{preview(conversation)}</p>
          </div>
          <div className={styles.conversationMeta}>
            <span>{formatTime(conversation.lastActivityAt)}</span>
            {conversation.viewer.unreadCount > 0 && <span className={styles.unread}>{conversation.viewer.unreadCount}</span>}
          </div>
        </a>;
      })}
    </section>}

    {meta.hasMore && <div className={styles.loadMore}>
      <button className={styles.button} type="button" disabled={loadingMore} onClick={() => void load(meta.nextCursor, true)}>
        {loadingMore ? "Loading…" : "Load older conversations"}
      </button>
    </div>}
  </main>;
}
