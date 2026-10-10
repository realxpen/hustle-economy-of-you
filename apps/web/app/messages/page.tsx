"use client";

import Link from "next/link";
import { ExperienceState } from "../../components/experience/experience-state";
import { ExperienceHeader } from "../../components/navigation/experience-header";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
  if (message.text) return message.delegatedByAgent ? `Agent-assisted: ${message.text}` : message.text;
  if (message.context) return `${message.context.type.toLowerCase()} shared`;
  if (message.attachment) return `${message.attachment.type.toLowerCase()} attachment`;
  return "New message";
}

export default function MessagesPage() {
  const router = useRouter();
  const backgroundRefreshInFlight = useRef(false);
  const [items, setItems] = useState<ConversationSummary[]>([]);
  const [meta, setMeta] = useState<Pick<ConversationPage, "nextCursor" | "hasMore">>({
    nextCursor: null,
    hasMore: false
  });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const visibleItems = useMemo(() => items.filter((conversation) => {
    if (unreadOnly && conversation.viewer.unreadCount === 0) return false;
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return true;
    const other = conversation.otherParticipant;
    return [other?.displayName, other?.username, other?.professionalProfile?.primarySkill]
      .some((value) => value?.toLocaleLowerCase().includes(needle));
  }), [items, query, unreadOnly]);

  async function load(cursor: string | null = null, append = false, silent = false) {
    if (silent && backgroundRefreshInFlight.current) return;
    if (silent) backgroundRefreshInFlight.current = true;
    if (!silent) append ? setLoadingMore(true) : setLoading(true);
    if (!silent) setError(null);
    try {
      const page = await listConversations({ cursor, limit: 20 });
      setItems((current) => {
        if (append) return [...current, ...page.items];
        if (!silent) return page.items;

        const refreshedIds = new Set(page.items.map((conversation) => conversation.id));
        const olderItems = current.filter((conversation) => !refreshedIds.has(conversation.id));
        return [...page.items, ...olderItems];
      });
      if (!silent) {
        setMeta({ nextCursor: page.nextCursor, hasMore: page.hasMore });
        setError(null);
      }
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Could not load messages";
      if (!silent) setError(message);
      if (message.toLowerCase().includes("sign in")) {
        setTimeout(() => router.replace("/auth"), 900);
      }
    } finally {
      if (silent) backgroundRefreshInFlight.current = false;
      if (!silent) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    let active = true;
    const sync = () => {
      if (!active || document.visibilityState !== "visible") return;
      void load(null, false, true);
    };

    const interval = window.setInterval(sync, 4_000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") sync();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return <main className={styles.shell}>
    <ExperienceHeader section="Messages" secondaryLinks={[{ href: "/notifications", label: "Activity" }, { href: "/account", label: "Your identity" }]} />

    <section className={styles.hero}>
      <p className={styles.eyebrow}>DIRECT MESSAGING</p>
      <h1>Keep opportunity context in the conversation.</h1>
      <p>Messages belong to the same Hustle identity. A client can move from discovery into a direct thread without creating a separate buyer or seller inbox.</p>
    </section>

    <div className={styles.inboxTools} aria-label="Conversation filters">
      <label className={styles.searchLabel}>Find a conversation
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, username or skill" />
      </label>
      <button className={styles.filterButton} type="button" aria-pressed={unreadOnly} onClick={() => setUnreadOnly((value) => !value)}>{unreadOnly ? "Showing unread" : "Unread only"}</button>
    </div>
    {error && <ExperienceState kind="error" title="Inbox unavailable." description={error} action={{ label: "Retry inbox", onClick: () => void load() }} />}
    {!error && loading && <ExperienceState kind="loading" title="Loading conversations…" description="Fetching your messages and recent replies." />}
    {!error && !loading && items.length === 0 && <ExperienceState kind="empty" title="No conversations yet." description="Open a Hustler profile, Service or Product and tap Message to get started." action={{ label: "Discover Hustlers", href: "/home" }} />}

    {!loading && !error && items.length > 0 && visibleItems.length === 0 && <ExperienceState kind="empty" compact title="No conversations match." description="Try a different name or turn off the unread filter." action={{ label: "Clear filters", onClick: () => { setQuery(""); setUnreadOnly(false); } }} />}
    {visibleItems.length > 0 && <section className={styles.inbox} aria-label="Your conversations">
      {visibleItems.map((conversation) => {
        const other = conversation.otherParticipant;
        const initial = (other?.displayName ?? other?.username ?? "H").charAt(0).toUpperCase();
        const unread = conversation.viewer.unreadCount > 0;
        return <Link
          key={conversation.id}
          className={`${styles.conversation} ${unread ? styles.conversationUnread : ""}`}
          href={`/messages/${conversation.id}`}
        >
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
            {unread && <span className={styles.unreadWrap} aria-label={`${conversation.viewer.unreadCount} unread messages`}>
              <span className={styles.unreadDot} aria-hidden="true" />
              <span className={styles.unread}>{conversation.viewer.unreadCount}</span>
            </span>}
          </div>
        </Link>;
      })}
    </section>}

    {meta.hasMore && <div className={styles.loadMore}>
      <button className={styles.button} type="button" disabled={loadingMore} onClick={() => void load(meta.nextCursor, true)}>
        {loadingMore ? "Loading…" : "Load older conversations"}
      </button>
    </div>}
  </main>;
}
