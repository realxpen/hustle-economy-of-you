"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  getConversation,
  listMessages,
  markConversationRead,
  recordMessageContextOpened,
  sendMessage,
  type ConversationSummary,
  type MessageContextType,
  type MessagePage,
  type MessagingMessage
} from "../../../lib/messaging";
import styles from "../messages.module.css";

function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    day: "numeric"
  }).format(new Date(value));
}

function contextLabel(type: MessageContextType) {
  if (type === "POST") return "Post";
  if (type === "SERVICE") return "Service";
  return "Product";
}

export default function ConversationPage() {
  const params = useParams<{ conversationId: string }>();
  const conversationId = params?.conversationId;
  const [conversation, setConversation] = useState<ConversationSummary | null>(null);
  const [messages, setMessages] = useState<MessagingMessage[]>([]);
  const [meta, setMeta] = useState<Pick<MessagePage, "nextCursor" | "hasMore">>({ nextCursor: null, hasMore: false });
  const [text, setText] = useState("");
  const [pendingContext, setPendingContext] = useState<{ type: MessageContextType; id: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const other = conversation?.otherParticipant ?? null;
  const viewerUserId = conversation?.viewer.userId ?? null;
  const initial = (other?.displayName ?? other?.username ?? "H").charAt(0).toUpperCase();

  const canSend = useMemo(() => Boolean(text.trim() || pendingContext), [text, pendingContext]);

  useEffect(() => {
    if (!conversationId) return;

    const search = new URLSearchParams(window.location.search);
    const rawType = search.get("contextType")?.toUpperCase();
    const contextId = search.get("contextId")?.trim();
    if ((rawType === "POST" || rawType === "SERVICE" || rawType === "PRODUCT") && contextId) {
      setPendingContext({ type: rawType, id: contextId });
    }

    Promise.all([
      getConversation(conversationId),
      listMessages(conversationId, { limit: 50 })
    ])
      .then(async ([nextConversation, page]) => {
        setConversation(nextConversation);
        setMessages(page.items);
        setMeta({ nextCursor: page.nextCursor, hasMore: page.hasMore });
        const last = page.items.at(-1);
        if (last) {
          const read = await markConversationRead(conversationId, last.id);
          setConversation((current) => current ? {
            ...current,
            viewer: { ...current.viewer, lastReadAt: read.lastReadAt, unreadCount: read.unreadCount }
          } : current);
        }
      })
      .catch((reason: Error) => {
        setError(reason.message);
        if (reason.message.toLowerCase().includes("sign in")) {
          setTimeout(() => window.location.assign("/auth"), 900);
        }
      })
      .finally(() => setLoading(false));
  }, [conversationId]);

  async function refresh() {
    if (!conversationId) return;
    setError(null);
    try {
      const [nextConversation, page] = await Promise.all([
        getConversation(conversationId),
        listMessages(conversationId, { limit: 50 })
      ]);
      setConversation(nextConversation);
      setMessages(page.items);
      setMeta({ nextCursor: page.nextCursor, hasMore: page.hasMore });
      const last = page.items.at(-1);
      if (last) {
        const read = await markConversationRead(conversationId, last.id);
        setConversation((current) => current ? {
          ...current,
          viewer: { ...current.viewer, lastReadAt: read.lastReadAt, unreadCount: read.unreadCount }
        } : current);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not refresh conversation");
    }
  }

  async function loadOlder() {
    if (!conversationId || !meta.nextCursor) return;
    setLoadingOlder(true);
    try {
      const page = await listMessages(conversationId, { cursor: meta.nextCursor, limit: 50 });
      setMessages((current) => [...page.items, ...current]);
      setMeta({ nextCursor: page.nextCursor, hasMore: page.hasMore });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load older messages");
    } finally {
      setLoadingOlder(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!conversationId || !canSend || sending) return;
    setSending(true);
    setError(null);
    try {
      const sent = await sendMessage(conversationId, {
        ...(text.trim() ? { text: text.trim() } : {}),
        ...(pendingContext ? { contextType: pendingContext.type, contextId: pendingContext.id } : {})
      });
      setMessages((current) => [...current, sent]);
      setText("");
      setPendingContext(null);
      window.history.replaceState(null, "", `/messages/${conversationId}`);
      await markConversationRead(conversationId, sent.id);
      const nextConversation = await getConversation(conversationId);
      setConversation(nextConversation);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not send message");
    } finally {
      setSending(false);
    }
  }

  async function openContext(message: MessagingMessage) {
    if (!conversationId || !message.context) return;
    try {
      await recordMessageContextOpened(conversationId, message.id);
    } catch {
      // Observation must never block canonical navigation.
    }
    window.location.assign(message.context.url);
  }

  if (loading) return <main className={styles.start}><section className={styles.startCard}><p className={styles.eyebrow}>HUSTLE MESSAGING</p><h1>Loading conversation…</h1></section></main>;
  if (!conversation) return <main className={styles.start}><section className={styles.startCard}><p className={styles.eyebrow}>HUSTLE MESSAGING</p><h1>Conversation unavailable.</h1><p>{error ?? "This thread could not be opened."}</p><a href="/messages">Back to messages →</a></section></main>;

  return <main className={styles.threadShell}>
    <header className={styles.threadHeader}>
      <a className={styles.back} href="/messages">←</a>
      <div className={styles.threadIdentity}>
        <div className={styles.avatar}>{other?.avatarUrl ? <img src={other.avatarUrl} alt="" /> : initial}</div>
        <div className={styles.identityText}>
          <strong>{other?.displayName ?? other?.username ?? "Hustle user"}{other?.verified ? " · Verified" : ""}</strong>
          <span>@{other?.username ?? "user"}{other?.professionalProfile?.primarySkill ? ` · ${other.professionalProfile.primarySkill}` : ""}</span>
        </div>
      </div>
      <button className={styles.refresh} type="button" onClick={() => void refresh()}>Refresh</button>
    </header>

    <div className={styles.threadBody}>
      <section className={styles.messages}>
        {meta.hasMore && <button className={styles.older} type="button" disabled={loadingOlder} onClick={() => void loadOlder()}>{loadingOlder ? "Loading…" : "Load older messages"}</button>}
        {messages.length === 0 && <div className={styles.empty}><strong>Start the conversation.</strong><p>Ask about the work, Service or Product that brought you here.</p></div>}
        {messages.map((message) => {
          const mine = message.senderId === viewerUserId;
          return <div key={message.id} className={`${styles.bubbleRow} ${mine ? styles.mine : styles.theirs}`}>
            <article className={styles.bubble}>
              {!mine && <div className={styles.sender}>{message.sender.displayName ?? message.sender.username ?? "Hustle user"}</div>}
              {message.text && <p className={styles.text}>{message.text}</p>}
              {message.attachment && <div className={styles.attachment}>{message.attachment.type === "IMAGE" ? "Image" : "File"}: {message.attachment.fileName ?? "attachment"}</div>}
              {message.context && <a className={styles.context} href={message.context.url} onClick={(event) => { event.preventDefault(); void openContext(message); }}>
                <strong>{contextLabel(message.context.type)} context</strong><br />Open current canonical {contextLabel(message.context.type).toLowerCase()} →
              </a>}
              <span className={styles.time}>{formatTime(message.createdAt)}</span>
            </article>
          </div>;
        })}
        {error && <p className={styles.threadError}>{error}</p>}
      </section>

      <div className={styles.composerWrap}>
        <form className={styles.composer} onSubmit={submit}>
          {pendingContext && <div className={styles.pendingContext}>
            <span><strong>{contextLabel(pendingContext.type)}</strong> will be attached to your next message.</span>
            <button type="button" onClick={() => { setPendingContext(null); window.history.replaceState(null, "", `/messages/${conversationId}`); }}>Remove</button>
          </div>}
          <div className={styles.composeRow}>
            <textarea
              rows={2}
              maxLength={4000}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={`Message ${other?.displayName ?? other?.username ?? "this Hustle user"}…`}
            />
            <button type="submit" disabled={!canSend || sending}>{sending ? "Sending…" : "Send"}</button>
          </div>
          <p className={styles.notice}>Text and canonical Post/Service/Product context are live. Private image/file upload and typing presence arrive in Phase 10D.</p>
        </form>
      </div>
    </div>
  </main>;
}
