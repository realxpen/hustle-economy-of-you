"use client";

import { ExperienceStatus } from "../../components/navigation/experience-status";
import { ExperienceState } from "../../components/experience/experience-state";
import { ExperienceHeader } from "../../components/navigation/experience-header";
import { useCallback, useEffect, useState } from "react";
import {
  type BookingPage,
  type BookingRecord,
  formatBookingPrice,
  listClientBookings,
  listHustlerBookings
} from "../../lib/booking";
import styles from "./bookings.module.css";

function formatDate(value: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function BookingCard({ booking }: { booking: BookingRecord }) {
  const counterpart = booking.viewerRole === "CLIENT" ? booking.hustler : booking.client;
  return <a className={[styles.card, "h-experience-surface"].join(" ")} href={`/bookings/${booking.id}`}>
    <div className={styles.cardTop}>
      <div>
        <small className={styles.eyebrow}>{booking.viewerRole === "CLIENT" ? "YOUR REQUEST" : "SERVICE REQUEST"}</small>
        <h3>{booking.serviceTitleSnapshot}</h3>
      </div>
      <ExperienceStatus kind="booking" value={booking.status} />
    </div>
    <div className={styles.meta}>
      <span>{formatBookingPrice(booking)}</span>
      <span>{formatDate(booking.confirmedStartAt ?? booking.requestedStartAt)}</span>
      <span>{counterpart.displayName ?? counterpart.username ?? "Hustle user"}</span>
    </div>
    <p className={styles.next}>{booking.nextAction}</p>
  </a>;
}

function BookingSection({
  title,
  eyebrow,
  page,
  error,
  onLoadMore,
  loadingMore,
  onRetry,
  noCapability = false
}: {
  title: string;
  eyebrow: string;
  page: BookingPage | null;
  error: string | null;
  onLoadMore: () => void;
  loadingMore: boolean;
  onRetry: () => void;
  noCapability?: boolean;
}) {
  return <section className={[styles.panel, "h-experience-surface"].join(" ")}>
    <div className={styles.panelHead}>
      <div><small>{eyebrow}</small><h2>{title}</h2></div>
      {page && <small>{page.items.length} loaded</small>}
    </div>
    {error && <ExperienceState compact kind={noCapability ? "empty" : "error"} title={noCapability ? "Hustler tools are not active yet." : "Could not load bookings."} description={error} action={noCapability ? { label: "View your profile", href: "/account" } : { label: "Retry", onClick: onRetry }} />}
    {!error && !page && <ExperienceState compact kind="loading" title="Getting your bookings…" />}
    {!error && page && page.items.length === 0 && <ExperienceState compact kind="empty" title="No bookings in this view yet." description={eyebrow === "AS CLIENT" ? "Find a Service and request a time when you're ready." : "Requests for your published Services will appear here."} action={eyebrow === "AS CLIENT" ? { label: "Explore Services", href: "/marketplace" } : undefined} />}
    {page && page.items.length > 0 && <div className={styles.list}>{page.items.map((booking) => <BookingCard key={booking.id} booking={booking} />)}</div>}
    {page?.hasMore && <button className={styles.loadMore} onClick={onLoadMore} disabled={loadingMore}>{loadingMore ? "Loading…" : "Load more"}</button>}
  </section>;
}

export default function BookingsPage() {
  const [clientPage, setClientPage] = useState<BookingPage | null>(null);
  const [hustlerPage, setHustlerPage] = useState<BookingPage | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const [hustlerError, setHustlerError] = useState<string | null>(null);
  const [loadingMoreClient, setLoadingMoreClient] = useState(false);
  const [loadingMoreHustler, setLoadingMoreHustler] = useState(false);

  const loadInitial = useCallback(async () => {
    const [client, hustler] = await Promise.allSettled([
      listClientBookings({ limit: 20 }),
      listHustlerBookings({ limit: 20 })
    ]);

    if (client.status === "fulfilled") { setClientPage(client.value); setClientError(null); }
    else setClientError(client.reason instanceof Error ? client.reason.message : "Could not load client bookings");

    if (hustler.status === "fulfilled") { setHustlerPage(hustler.value); setHustlerError(null); }
    else {
      const message = hustler.reason instanceof Error ? hustler.reason.message : "Could not load Hustler bookings";
      if (/ACTIVE HUSTLER/i.test(message)) setHustlerError("Hustler requests appear here once this account has an active Hustler capability.");
      else setHustlerError(message);
    }
  }, []);

  useEffect(() => { void loadInitial(); }, [loadInitial]);

  async function loadMoreClient() {
    if (!clientPage?.nextCursor) return;
    setLoadingMoreClient(true);
    try {
      const next = await listClientBookings({ cursor: clientPage.nextCursor, limit: 20 });
      setClientPage({ ...next, items: [...clientPage.items, ...next.items] });
    } catch (reason) {
      setClientError(reason instanceof Error ? reason.message : "Could not load more bookings");
    } finally { setLoadingMoreClient(false); }
  }

  async function loadMoreHustler() {
    if (!hustlerPage?.nextCursor) return;
    setLoadingMoreHustler(true);
    try {
      const next = await listHustlerBookings({ cursor: hustlerPage.nextCursor, limit: 20 });
      setHustlerPage({ ...next, items: [...hustlerPage.items, ...next.items] });
    } catch (reason) {
      setHustlerError(reason instanceof Error ? reason.message : "Could not load more requests");
    } finally { setLoadingMoreHustler(false); }
  }

  return <main className={[styles.shell, "h-experience-shell"].join(" ")}>
    <ExperienceHeader section="Bookings" secondaryLinks={[{ href: "/marketplace", label: "Find a service ↗" }, { href: "/messages", label: "Messages" }]} />

    <section className={[styles.hero, "h-experience-hero"].join(" ")}>
      <div><p className={styles.eyebrow}>BOOKING MANAGER</p><h1 className="h-experience-heading">Work, clearly scheduled.</h1></div>
      <p>One identity, two relationship views. Requests you make and requests for your Services live together without switching account modes.</p>
    </section>

    <div className={styles.sections}>
      <BookingSection title="Your bookings" eyebrow="AS CLIENT" page={clientPage} error={clientError} onLoadMore={loadMoreClient} loadingMore={loadingMoreClient} onRetry={() => void loadInitial()} />
      <BookingSection title="Requests for your services" eyebrow="AS HUSTLER" page={hustlerPage} error={hustlerError} onLoadMore={loadMoreHustler} loadingMore={loadingMoreHustler} onRetry={() => void loadInitial()} noCapability={Boolean(hustlerError?.includes("active Hustler capability"))} />
    </div>

    <footer className={styles.footer}><span>Booking status is server-authoritative.</span><strong>Funding and settlement reflect the payment system’s confirmed state.</strong></footer>
  </main>;
}
