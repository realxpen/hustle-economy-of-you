"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ConversationSafetyActions } from "../../../components/trust/conversation-safety-actions";
import {
  createMessageAttachmentUrl,
  deleteMessageAttachment,
  getConversation,
  getConversationTyping,
  listMessages,
  markConversationRead,
  recordMessageContextOpened,
  sendMessage,
  setConversationTyping,
  uploadMessageAttachment,
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

function formatBytes(value: number | null) {
  if (!value) return "";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function contextLabel(type: MessageContextType) {
  if (type === "POST") return "Post";
  if (type === "SERVICE") return "Service";
  return "Product";
}

function contextUrl(type: MessageContextType, id: string) {
  if (type === "POST") return `/posts/${id}`;
  if (type === "SERVICE") return `/services/${id}`;
  return `/products/${id}`;
}

function mergeMessages(current: MessagingMessage[], incoming: MessagingMessage[]) {
  const byId = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) byId.set(message.id, message);
  return Array.from(byId.values()).sort(
    (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
  );
}

function latestConfirmedMessage(messages: MessagingMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (!messages[index].id.startsWith("optimistic-")) return messages[index];
  }
  return null;
}

export default function ConversationPage() {
  const params = useParams<{ conversationId: string }>();
  const router = useRouter();
  const conversationId = params?.conversationId;
  const [conversation, setConversation] = useState<ConversationSummary | null>(null);
  const [messages, setMessages] = useState<MessagingMessage[]>([]);
  const [meta, setMeta] = useState<Pick<MessagePage, "nextCursor" | "hasMore">>({ nextCursor: null, hasMore: false });
  const [text, setText] = useState("");
  const [pendingContext, setPendingContext] = useState<{ type: MessageContextType; id: string } | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string, string>>({});
  const [otherTyping, setOtherTyping] = useState(false);
  const [otherLastReadAt, setOtherLastReadAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentRef = useRef(0);
  const newestMessageRef = useRef<{ id: string; createdAt: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const other = conversation?.otherParticipant ?? null;
  const viewerUserId = conversation?.viewer.userId ?? null;
  const initial = (other?.displayName ?? other?.username ?? "H").charAt(0).toUpperCase();

  const canSend = useMemo(
    () => Boolean(text.trim() || pendingContext || selectedFile),
    [text, pendingContext, selectedFile]
  );

  useEffect(() => {
    const latest = latestConfirmedMessage(messages);
    newestMessageRef.current = latest ? { id: latest.id, createdAt: latest.createdAt } : null;
    messagesEndRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages]);

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
      .then(([nextConversation, page]) => {
        setConversation(nextConversation);
        setMessages(page.items);
        setMeta({ nextCursor: page.nextCursor, hasMore: page.hasMore });
        setLoading(false);

        const last = page.items.at(-1);
        if (last) {
          void markConversationRead(conversationId, last.id)
            .then((read) => {
              setConversation((current) => current ? {
                ...current,
                viewer: { ...current.viewer, lastReadAt: read.lastReadAt, unreadCount: read.unreadCount }
              } : current);
            })
            .catch(() => undefined);
        }
      })
      .catch((reason: Error) => {
        setError(reason.message);
        setLoading(false);
        if (reason.message.toLowerCase().includes("sign in")) {
          setTimeout(() => router.replace("/auth"), 900);
        }
      });
  }, [conversationId, router]);

  useEffect(() => {
    let active = true;
    const pending = messages.filter((message) => message.attachment && !attachmentUrls[message.id]);
    if (pending.length === 0) return () => { active = false; };

    void Promise.all(
      pending.map(async (message) => {
        if (!message.attachment) return null;
        try {
          return [message.id, await createMessageAttachmentUrl(message.attachment.storageKey)] as const;
        } catch {
          return null;
        }
      })
    ).then((entries) => {
      if (!active) return;
      setAttachmentUrls((current) => {
        const next = { ...current };
        for (const entry of entries) if (entry) next[entry[0]] = entry[1];
        return next;
      });
    });

    return () => { active = false; };
  }, [messages, attachmentUrls]);

  useEffect(() => {
    if (!conversationId || !viewerUserId) return;
    let active = true;
    let syncing = false;
    let interval: number | null = null;

    const syncMessages = async () => {
      if (!active || syncing) return;
      syncing = true;
      try {
        const after = newestMessageRef.current;
        const page = await listMessages(conversationId, after
          ? { after, limit: 50 }
          : { limit: 50 });
        if (!active || page.items.length === 0) return;

        const newest = page.items.at(-1) ?? null;
        const previousNewestId = newestMessageRef.current?.id ?? null;
        setMessages((current) => mergeMessages(current, page.items));

        if (newest) {
          newestMessageRef.current = { id: newest.id, createdAt: newest.createdAt };
        }

        if (newest && newest.id !== previousNewestId && newest.senderId !== viewerUserId) {
          void markConversationRead(conversationId, newest.id)
            .then((read) => {
              if (!active) return;
              setConversation((current) => current ? {
                ...current,
                lastActivityAt: newest.createdAt,
                lastMessage: newest,
                viewer: { ...current.viewer, lastReadAt: read.lastReadAt, unreadCount: read.unreadCount }
              } : current);
            })
            .catch(() => undefined);
        }
      } catch {
        // Background sync must never make the thread feel broken.
      } finally {
        syncing = false;
      }
    };

    const schedule = () => {
      if (interval !== null) window.clearInterval(interval);
      const delay = document.visibilityState === "visible" ? 1_250 : 5_000;
      interval = window.setInterval(() => void syncMessages(), delay);
    };

    schedule();
    document.addEventListener("visibilitychange", schedule);

    return () => {
      active = false;
      if (interval !== null) window.clearInterval(interval);
      document.removeEventListener("visibilitychange", schedule);
    };
  }, [conversationId, viewerUserId]);

  useEffect(() => {
    if (!conversationId || !viewerUserId) return;
    let active = true;

    const poll = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const state = await getConversationTyping(conversationId);
        if (active) {
          setOtherTyping(state.typingUserIds.length > 0);
          setOtherLastReadAt(state.otherLastReadAt);
        }
      } catch {
        if (active) setOtherTyping(false);
      }
    };

    void poll();
    const interval = window.setInterval(() => void poll(), 3_000);
    return () => {
      active = false;
      window.clearInterval(interval);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      void setConversationTyping(conversationId, false).catch(() => undefined);
    };
  }, [conversationId, viewerUserId]);

  async function refresh() {
    if (!conversationId) return;
    setError(null);
    try {
      const [nextConversation, page] = await Promise.all([
        getConversation(conversationId),
        listMessages(conversationId, { limit: 50 })
      ]);
      setConversation(nextConversation);
      setMessages((current) => mergeMessages(current, page.items));
      setMeta({ nextCursor: page.nextCursor, hasMore: page.hasMore });
      const last = page.items.at(-1);
      if (last) {
        newestMessageRef.current = { id: last.id, createdAt: last.createdAt };
        void markConversationRead(conversationId, last.id)
          .then((read) => {
            setConversation((current) => current ? {
              ...current,
              viewer: { ...current.viewer, lastReadAt: read.lastReadAt, unreadCount: read.unreadCount }
            } : current);
          })
          .catch(() => undefined);
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
      setMessages((current) => mergeMessages(page.items, current));
      setMeta({ nextCursor: page.nextCursor, hasMore: page.hasMore });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load older messages");
    } finally {
      setLoadingOlder(false);
    }
  }

  function handleTextChange(value: string) {
    setText(value);
    if (!conversationId) return;

    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    if (!value.trim()) {
      void setConversationTyping(conversationId, false).catch(() => undefined);
      lastTypingSentRef.current = 0;
      return;
    }

    const now = Date.now();
    if (now - lastTypingSentRef.current > 2_500) {
      lastTypingSentRef.current = now;
      void setConversationTyping(conversationId, true).catch(() => undefined);
    }

    typingTimerRef.current = setTimeout(() => {
      lastTypingSentRef.current = 0;
      void setConversationTyping(conversationId, false).catch(() => undefined);
    }, 3_500);
  }

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      setError("Attachment must be 25 MB or smaller");
      event.target.value = "";
      return;
    }
    setError(null);
    setSelectedFile(file);
    event.target.value = "";
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!conversationId || !viewerUserId || !canSend || sending) return;

    const outgoingText = text.trim();
    const outgoingContext = pendingContext;
    const outgoingFile = selectedFile;
    const optimisticId = `optimistic-${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    setSending(true);
    setError(null);
    setText("");
    setPendingContext(null);
    setSelectedFile(null);
    window.history.replaceState(null, "", `/messages/${conversationId}`);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    lastTypingSentRef.current = 0;
    void setConversationTyping(conversationId, false).catch(() => undefined);

    let uploadedStorageKey: string | null = null;
    let optimisticAdded = false;

    try {
      const attachment = outgoingFile
        ? await uploadMessageAttachment(conversationId, outgoingFile)
        : null;
      uploadedStorageKey = attachment?.storageKey ?? null;

      const optimistic: MessagingMessage = {
        id: optimisticId,
        conversationId,
        senderId: viewerUserId,
        text: outgoingText || null,
        attachment: attachment ? {
          type: attachment.type,
          storageKey: attachment.storageKey,
          fileName: attachment.fileName,
          mimeType: attachment.mimeType,
          sizeBytes: attachment.sizeBytes
        } : null,
        context: outgoingContext ? {
          type: outgoingContext.type,
          id: outgoingContext.id,
          url: contextUrl(outgoingContext.type, outgoingContext.id)
        } : null,
        sender: {
          id: viewerUserId,
          displayName: null,
          username: null,
          avatarUrl: null
        },
        createdAt: now,
        updatedAt: now
      };

      setMessages((current) => [...current, optimistic]);
      optimisticAdded = true;

      const sent = await sendMessage(conversationId, {
        ...(outgoingText ? { text: outgoingText } : {}),
        ...(attachment ? {
          attachmentType: attachment.type,
          attachmentStorageKey: attachment.storageKey,
          attachmentFileName: attachment.fileName,
          attachmentMimeType: attachment.mimeType,
          attachmentSizeBytes: attachment.sizeBytes
        } : {}),
        ...(outgoingContext ? { contextType: outgoingContext.type, contextId: outgoingContext.id } : {})
      });

      newestMessageRef.current = { id: sent.id, createdAt: sent.createdAt };
      setMessages((current) => {
        const withoutOptimisticOrDuplicate = current.filter(
          (message) => message.id !== optimisticId && message.id !== sent.id
        );
        return mergeMessages(withoutOptimisticOrDuplicate, [sent]);
      });
      setConversation((current) => current ? {
        ...current,
        lastActivityAt: sent.createdAt,
        lastMessage: sent,
        viewer: { ...current.viewer, lastReadAt: sent.createdAt, unreadCount: 0 }
      } : current);
    } catch (reason) {
      if (optimisticAdded) {
        setMessages((current) => current.filter((message) => message.id !== optimisticId));
      }
      if (uploadedStorageKey) {
        await deleteMessageAttachment(uploadedStorageKey).catch(() => undefined);
      }
      setText((current) => current || outgoingText);
      setPendingContext((current) => current ?? outgoingContext);
      setSelectedFile((current) => current ?? outgoingFile);
      setError(reason instanceof Error ? reason.message : "Could not send message");
    } finally {
      setSending(false);
    }
  }

  function openContext(message: MessagingMessage) {
    if (!conversationId || !message.context) return;
    void recordMessageContextOpened(conversationId, message.id).catch(() => undefined);
    router.push(message.context.url);
  }

  if (loading) return <main className={styles.start}><section className={styles.startCard}><p className={styles.eyebrow}>HUSTLE MESSAGING</p><h1>Loading conversation…</h1></section></main>;
  if (!conversation) return <main className={styles.start}><section className={styles.startCard}><p className={styles.eyebrow}>HUSTLE MESSAGING</p><h1>Conversation unavailable.</h1><p>{error ?? "This thread could not be opened."}</p><Link href="/messages">Back to messages →</Link></section></main>;

  return <main className={styles.threadShell}>
    <header className={styles.threadHeader}>
      <Link className={styles.back} href="/messages">←</Link>
      <div className={styles.threadIdentity}>
        <div className={styles.avatar}>{other?.avatarUrl ? <img src={other.avatarUrl} alt="" /> : initial}</div>
        <div className={styles.identityText}>
          <strong>{other?.displayName ?? other?.username ?? "Hustle user"}{other?.verified ? " · Verified" : ""}</strong>
          <span>@{other?.username ?? "user"}{other?.professionalProfile?.primarySkill ? ` · ${other.professionalProfile.primarySkill}` : ""}</span>
        </div>
      </div>
      <button className={styles.refresh} type="button" onClick={() => void refresh()}>Refresh</button>
    </header>

    {conversationId && other && <div style={{ padding: "14px 18px 0" }}>
      <ConversationSafetyActions
        conversationId={conversationId}
        targetUserId={other.id}
        targetLabel={other.displayName ?? other.username ?? "this user"}
      />
    </div>}

    <div className={styles.threadBody}>
      <section className={styles.messages}>
        {meta.hasMore && <button className={styles.older} type="button" disabled={loadingOlder} onClick={() => void loadOlder()}>{loadingOlder ? "Loading…" : "Load older messages"}</button>}
        {messages.length === 0 && <div className={styles.empty}><strong>Start the conversation.</strong><p>Ask about the work, Service or Product that brought you here.</p></div>}
        {messages.map((message) => {
          const mine = message.senderId === viewerUserId;
          const attachmentUrl = attachmentUrls[message.id];
          const optimistic = message.id.startsWith("optimistic-");
          const read = Boolean(
            mine &&
            !optimistic &&
            otherLastReadAt &&
            new Date(otherLastReadAt).getTime() >= new Date(message.createdAt).getTime()
          );
          const receipt = mine
            ? optimistic
              ? "Sending…"
              : read
                ? "Read ✓✓"
                : "Delivered ✓✓"
            : null;
          return <div key={message.id} className={`${styles.bubbleRow} ${mine ? styles.mine : styles.theirs}`}>
            <article className={styles.bubble}>
              {!mine && <div className={styles.sender}>{message.sender.displayName ?? message.sender.username ?? "Hustle user"}</div>}
              {message.text && <p className={styles.text}>{message.text}</p>}
              {message.attachment && <div className={styles.attachment}>
                {message.attachment.type === "IMAGE" && attachmentUrl
                  ? <a href={attachmentUrl} target="_blank" rel="noreferrer"><img src={attachmentUrl} alt={message.attachment.fileName ?? "Message image"} /></a>
                  : attachmentUrl
                    ? <a href={attachmentUrl} target="_blank" rel="noreferrer"><strong>{message.attachment.fileName ?? "Attachment"}</strong><span>{formatBytes(message.attachment.sizeBytes)} · Open private file ↗</span></a>
                    : <span>{message.attachment.fileName ?? "Private attachment"} · Loading secure access…</span>}
              </div>}
              {message.context && <a className={styles.context} href={message.context.url} onClick={(event) => { event.preventDefault(); openContext(message); }}>
                <strong>{contextLabel(message.context.type)} context</strong><br />Open current canonical {contextLabel(message.context.type).toLowerCase()} →
              </a>}
              <span className={styles.time}>
                {formatTime(message.createdAt)}
                {receipt && <span className={styles.receipt}> · {receipt}</span>}
              </span>
            </article>
          </div>;
        })}
        <div ref={messagesEndRef} />
        {error && <p className={styles.threadError}>{error}</p>}
      </section>

      <div className={styles.composerWrap}>
        <form className={styles.composer} onSubmit={submit}>
          {otherTyping && <div className={styles.typingIndicator}>{other?.displayName ?? other?.username ?? "Hustle user"} is typing…</div>}
          {pendingContext && <div className={styles.pendingContext}>
            <span><strong>{contextLabel(pendingContext.type)}</strong> will be attached to your next message.</span>
            <button type="button" onClick={() => { setPendingContext(null); window.history.replaceState(null, "", `/messages/${conversationId}`); }}>Remove</button>
          </div>}
          {selectedFile && <div className={styles.pendingFile}>
            <span><strong>{selectedFile.type.startsWith("image/") ? "Image" : "File"}</strong> · {selectedFile.name} · {formatBytes(selectedFile.size)}</span>
            <button type="button" onClick={() => setSelectedFile(null)}>Remove</button>
          </div>}
          <div className={styles.composeRow}>
            <label className={styles.attachButton}>
              <input
                type="file"
                onChange={chooseFile}
                accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain,text/csv,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/zip"
              />
              Attach
            </label>
            <textarea
              rows={2}
              maxLength={4000}
              value={text}
              onChange={(event) => handleTextChange(event.target.value)}
              placeholder={`Message ${other?.displayName ?? other?.username ?? "this Hustle user"}…`}
            />
            <button type="submit" disabled={!canSend || sending}>{sending ? "Sending…" : "Send"}</button>
          </div>
          <p className={styles.notice}>Messages sync automatically using lightweight deltas while this thread is open. Private image/file attachments remain participant-only.</p>
        </form>
      </div>
    </div>
  </main>;
}
