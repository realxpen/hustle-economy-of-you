"use client";

import Link from "next/link";
import { ExperienceState } from "../../components/experience/experience-state";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  getNotifications,
  getUnreadNotificationCount,
  readAllNotifications,
  readNotification,
  type HustleNotification,
  type NotificationPage
} from "../../lib/notifications";
import styles from "./notifications.module.css";

function time(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function notificationTitle(item: HustleNotification) {
  if (item.kind === "SOCIAL" && item.href.startsWith("/posts/")) {
    if (item.unreadMessages > 1) return `${item.unreadMessages} new comments and replies`;
    if (item.messageCount > 1 && !item.unreadMessages) return `${item.messageCount} comments in this discussion`;
    return item.title;
  }
  if (item.kind !== "MESSAGE") return item.title;
  if (item.unreadMessages > 1) return `${item.unreadMessages} new messages`;
  if (item.unreadMessages === 1) return "New message";
  if (item.messageCount > 1) return `${item.messageCount} messages in this conversation`;
  return "Message";
}

function notificationDescription(item: HustleNotification) {
  if (item.kind === "MESSAGE") return "Open this conversation to catch up.";
  if (item.kind === "SOCIAL" && item.href.startsWith("/posts/") && item.messageCount > 1) {
    return "Open the post to see what's being discussed.";
  }
  return item.body;
}

function allowedHref(path: string) {
  return path.startsWith("/") && !path.startsWith("//") && !path.includes("\\")
    ? path
    : "/account";
}

export default function NotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<HustleNotification[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [unread, setUnread] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialLoad, setInitialLoad] = useState(true);

  async function refresh(cursor: string | null = null) {
    setBusy(true);
    setError(null);
    try {
      const [page, count] = await Promise.all([
        getNotifications(cursor), getUnreadNotificationCount()
      ]) as [NotificationPage, { count: number }];
      setItems(previous => cursor ? [...previous, ...page.items] : page.items);
      setNextCursor(page.nextCursor);
      setHasMore(page.hasMore);
      setUnread(count.count);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Could not load notifications";
      setError(message);
      if (message.toLowerCase().includes("sign in")) {
        router.replace("/auth");
      }
    } finally {
      setBusy(false);
      setInitialLoad(false);
    }
  }

  useEffect(() => { void refresh(); }, []);

  async function open(item: HustleNotification) {
    // Navigation is still available if the read receipt cannot be saved.
    if (!item.readAt) {
      try {
        await readNotification(item.id);
        setItems(current => current.map(row =>
          row.id === item.id ? { ...row, readAt: new Date().toISOString() } : row
        ));
        setUnread(current => Math.max(0, current - 1));
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Could not mark notification read");
      }
    }
    router.push(allowedHref(item.href));
  }

  async function markAllRead() {
    setBusy(true);
    setError(null);
    try {
      await readAllNotifications();
      setItems(current => current.map(item => ({
        ...item, readAt: item.readAt ?? new Date().toISOString()
      })));
      setUnread(0);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not mark notifications read");
    } finally { setBusy(false); }
  }

  return <main className={styles.shell}>
    <header className={styles.header}>
      <Link href="/" className={styles.brand}>HUSTLE<span>↗</span></Link>
      <nav className={styles.nav}>
        <Link href="/home">Discover</Link>
        <Link href="/messages">Messages</Link>
        <Link href="/account">Your identity</Link>
      </nav>
    </header>
    <div className={styles.content}>
      <section className={styles.hero}>
        <p className={styles.eyebrow}>YOUR ACTIVITY / THE ECONOMY OF YOU</p>
        <div className={styles.titleRow}>
          <div>
            <h1>Stay in the loop.</h1>
            <p>Important activity from your Hustle. No noise for the sake of engagement.</p>
          </div>
          <span className={styles.unreadCount}>{unread} unread</span>
        </div>
        <div className={styles.actions}>
          <button type="button" disabled={busy} onClick={() => void refresh()}>Refresh</button>
          <button type="button" disabled={busy || unread === 0} onClick={() => void markAllRead()}>
            Mark all read
          </button>
        </div>
      </section>
      {error && <ExperienceState kind="error" compact title="Could not update Activity." description={error} action={{label:"Try again",onClick:()=>void refresh(),disabled:busy}} />}
      {initialLoad && <ExperienceState kind="loading" title="Loading your Activity…" />}
      {!initialLoad && !error && items.length === 0 && <ExperienceState kind="empty" title="Nothing needs your attention yet." description="Messages, Booking and Order changes, new followers, and discussions about your work will appear here." action={{label:"Explore Hustle",href:"/home"}} />}
      <section aria-label="Notifications" className={styles.list}>
        {items.map(item => <button
          type="button" key={item.id} onClick={() => void open(item)}
          className={item.readAt ? styles.item : `${styles.item} ${styles.newItem}`}
        >
          <span className={styles.itemIcon} aria-hidden="true">{item.kind === "MESSAGE" ? "↗" : item.kind === "SOCIAL" ? "◎" : item.kind === "BOOKING" ? "▣" : item.kind === "ORDER" ? "◇" : "•"}</span>
          <span className={styles.itemText}>
            <span className={styles.itemHead}>
              <strong>{notificationTitle(item)}</strong>
              {!item.readAt && <span className={styles.dot} aria-label="Unread notification" />}
            </span>
            <span className={styles.description}>{notificationDescription(item)}</span>
            <time dateTime={item.createdAt}>{time(item.createdAt)}</time>
          </span>
          <span aria-hidden="true" className={styles.openArrow}>→</span>
        </button>)}
      </section>
      {hasMore && <button type="button" className={styles.loadMore}
        disabled={busy} onClick={() => void refresh(nextCursor)}>
        {busy ? "Loading…" : "Load older activity"}
      </button>}
    </div>
  </main>;
}
