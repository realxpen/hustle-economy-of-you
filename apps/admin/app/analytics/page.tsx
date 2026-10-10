"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAdminAuth } from "../../components/admin-auth-provider";
import { getAdminAnalytics, type AnalyticsSnapshot, type AnalyticsWindow } from "../../lib/admin-api";
import styles from "./analytics.module.css";

const windows: AnalyticsWindow[] = [7, 30, 90];
const activityNames: Array<{ id: string; label: string; description: string }> = [
  { id: "feed.view", label: "Post views", description: "Views reported from the discovery feed" },
  { id: "feed.profile_clicked", label: "Creator visits", description: "Feed taps towards a creator profile" },
  { id: "feed.service_clicked", label: "Service taps", description: "Feed taps into attached Services" },
  { id: "feed.product_clicked", label: "Product taps", description: "Feed taps into attached Products" },
  { id: "search.performed", label: "Searches", description: "Search submissions, including repeated searches" },
  { id: "marketplace.result_clicked", label: "Market result taps", description: "Marketplace taps on an offer" }
];
const stages = [
  { id: "bookingsRequested", label: "Booking requests" },
  { id: "ordersPlaced", label: "Orders placed" },
  { id: "ordersPaid", label: "Orders paid" },
  { id: "verifiedReviews", label: "Verified reviews" }
] as const;

function count(value: number | undefined) {
  return new Intl.NumberFormat("en-NG").format(value ?? 0);
}
function dateLabel(day: string) {
  return new Intl.DateTimeFormat("en-NG", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
}

function Metric({ label, value, help, keySignal = false }: {
  label: string; value: number; help: string; keySignal?: boolean;
}) {
  return <article className={keySignal ? `${styles.metric} ${styles.metricPriority}` : styles.metric}>
    <span className={styles.metricLabel}>{label}</span>
    <strong>{count(value)}</strong>
    <p>{help}</p>
  </article>;
}

function Timeline({ snapshot }: { snapshot: AnalyticsSnapshot }) {
  const maximum = Math.max(1, ...snapshot.timeline.flatMap(item => stages.map(stage => item[stage.id])));
  return <section className={styles.timelinePanel} aria-labelledby="analytics-timeline">
    <div className={styles.panelHead}>
      <div>
        <p className={styles.eyebrow}>CANONICAL MILESTONES · UTC</p>
        <h2 id="analytics-timeline">Where activity becomes outcomes</h2>
        <p className={styles.panelCopy}>Daily events from actual Booking, Order and verified Review records. They are not uniquely linked customer journeys.</p>
      </div>
    </div>
    <div className={styles.legend}>
      {stages.map(stage => <span key={stage.id} className={styles.legendItem}>
        <i className={styles[stage.id]} aria-hidden="true" /> {stage.label}
      </span>)}
    </div>
    <div className={styles.chartScroll} role="region" tabIndex={0} aria-label="Horizontally scrollable daily activity chart">
      <div className={styles.chart} style={{ gridTemplateColumns: `repeat(${snapshot.timeline.length}, minmax(28px, 1fr))` }}>
        {snapshot.timeline.map(day => <div className={styles.day} key={day.day}
          aria-label={`${dateLabel(day.day)}: ${stages.map(stage => `${day[stage.id]} ${stage.label}`).join(", ")}`}>
          <div className={styles.barSet}>
            {stages.map(stage => <div key={stage.id}
              className={`${styles.bar} ${styles[stage.id]}`}
              style={{ height: `${day[stage.id] ? Math.max(5, day[stage.id] / maximum * 100) : 0}%` }}
              title={`${dateLabel(day.day)} · ${stage.label}: ${day[stage.id]}`} />)}
          </div>
          <time dateTime={day.day}>{dateLabel(day.day)}</time>
        </div>)}
      </div>
    </div>
    <p className={styles.footnote}>Bars are scaled to the highest daily milestone count. Zero indicates no qualifying recorded activity. Open the table below for precise values.</p>
    <details className={styles.dataDetails}>
      <summary>View all daily milestone counts as a table</summary>
      <div className={styles.dataTableWrap}>
        <table className={styles.dataTable}>
          <thead><tr><th scope="col">Day (UTC)</th>{stages.map(stage => <th scope="col" key={stage.id}>{stage.label}</th>)}</tr></thead>
          <tbody>{snapshot.timeline.map(day => <tr key={day.day}>
            <th scope="row">{dateLabel(day.day)}</th>
            {stages.map(stage => <td key={stage.id}>{count(day[stage.id])}</td>)}
          </tr>)}</tbody>
        </table>
      </div>
    </details>
  </section>;
}

export default function AnalyticsPage() {
  const { token } = useAdminAuth();
  const [days, setDays] = useState<AnalyticsWindow>(30);
  const [revision, setRevision] = useState(0);
  const [snapshot, setSnapshot] = useState<AnalyticsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let active = true;
    setLoading(true);
    setError(null);
    setSnapshot(null);
    void getAdminAnalytics(token, days).then(data => {
      if (active) setSnapshot(data);
    }).catch(reason => {
      if (active) setError(reason instanceof Error ? reason.message : "Could not load Analytics");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [token, days, revision]);

  const activity = useMemo(() => snapshot?.observation.events ?? {}, [snapshot]);

  return <main className="admin-shell">
    <header className={styles.header}>
      <div className={styles.heading}>
        <p className={styles.eyebrow}>HUSTLE / INTELLIGENCE / PHASE 21</p>
        <h1>Measure what <em>matters.</em></h1>
        <p>Discover whether useful attention is becoming actual opportunities, work and trust. Observations stay separate from verified outcomes.</p>
      </div>
      <div className={styles.headerActions}>
        <Link className="secondary" href="/">← Operations</Link>
        <button className="secondary" type="button" disabled={loading} onClick={() => setRevision(value => value + 1)}>Refresh metrics</button>
      </div>
    </header>

    <div className={styles.toolbar}>
      <div>
        <p className={styles.eyebrow}>REPORTING WINDOW</p>
        <div className={styles.segment} role="group" aria-label="Analytics period">
          {windows.map(value => <button type="button" key={value}
            aria-pressed={days === value}
            className={days === value ? styles.active : undefined}
            onClick={() => setDays(value)}>{value} days</button>)}
        </div>
      </div>
      <div className={styles.reportMeta}>
        {snapshot ? <>Updated <time dateTime={snapshot.generatedAt}>{new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(snapshot.generatedAt))} UTC</time>
          <small>All windows use UTC. No revenue estimates.</small></> : "Historical marketplace activity"}
      </div>
    </div>

    {loading && <section role="status" className={styles.state}>Reading authoritative Hustle records…</section>}
    {error && <section role="alert" className={styles.state}><strong>Analytics unavailable</strong><p>{error}</p><button type="button" className="secondary" onClick={() => setRevision(value => value + 1)}>Retry</button></section>}

    {snapshot && <>
      <section aria-labelledby="marketplace-outcomes" className={styles.section}>
        <div className={styles.sectionHeading}>
          <div><p className={styles.eyebrow}>01 / AUTHORITATIVE</p><h2 id="marketplace-outcomes">Real marketplace outcomes</h2></div>
          <span className={styles.verifiedPill}>Database-confirmed milestones</span>
        </div>
        <p className={styles.sectionIntro}>Counts are drawn from the underlying marketplace records. They reflect events reached during this period, not the same group of people advancing through every stage.</p>
        <div className={styles.metricGrid}>
          <Metric label="Messages sent" value={snapshot.authoritative.sentMessages} help="Messages recorded in conversations"/>
          <Metric label="Conversations created" value={snapshot.authoritative.newConversations} help="New threads; not necessarily enquiries"/>
          <Metric label="Bookings requested" value={snapshot.authoritative.bookingRequests} help="Client requests submitted" keySignal/>
          <Metric label="Bookings funded" value={snapshot.authoritative.fundedBookings} help="Recorded funding milestone" keySignal/>
          <Metric label="Bookings completed" value={snapshot.authoritative.completedBookings} help="Work completion milestones" keySignal/>
          <Metric label="Orders placed" value={snapshot.authoritative.placedOrders} help="New Order records" keySignal/>
          <Metric label="Orders paid" value={snapshot.authoritative.paidOrders} help="Authoritatively marked paid" keySignal/>
          <Metric label="Orders completed" value={snapshot.authoritative.completedOrders} help="Buyer-confirmed completion" keySignal/>
          <Metric label="Verified reviews" value={snapshot.authoritative.verifiedReviews} help="Published, transaction-backed reviews" keySignal/>
          <Metric label="Applied payment confirmations" value={snapshot.authoritative.appliedPayments} help="Successful PaymentAttempts applied to the domain"/>
        </div>
      </section>

      <section aria-labelledby="journey-association" className={styles.section}>
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>02 / OPT-IN ATTRIBUTION</p>
            <h2 id="journey-association">Discovery → opportunity</h2>
          </div>
          <span className={styles.observedPill}>Consented association · not causation</span>
        </div>
        <p className={styles.sectionIntro}>{snapshot.attribution.note}</p>
        <div className={styles.metricGrid}>
          <Metric label="Consented Booking requests" value={snapshot.attribution.bookings.consentingOutcomes} help="Bookings from users whose opt-in remains active" />
          <Metric label="Bookings linked to offer tap" value={snapshot.attribution.bookings.linkedOutcomes} help="Same customer and Service, within seven days" keySignal />
          <Metric label="Consented Orders placed" value={snapshot.attribution.orders.consentingOutcomes} help="Orders from users whose opt-in remains active" />
          <Metric label="Orders linked to offer tap" value={snapshot.attribution.orders.linkedOutcomes} help="Same customer and Product, within seven days" keySignal />
        </div>
        <div className={styles.activityGrid}>
          {([
            { label: "Booking associations", values: snapshot.attribution.bookings.byLastEligibleClick },
            { label: "Order associations", values: snapshot.attribution.orders.byLastEligibleClick }
          ] as const).map(group => <article className={styles.activityCard} key={group.label}>
            <span>{group.label} by last eligible interaction</span>
            <p>Feed: {count(group.values.feed)}</p>
            <p>Search: {count(group.values.search)}</p>
            <p>Marketplace: {count(group.values.marketplace)}</p>
          </article>)}
        </div>
        <p className={styles.sectionIntro}>Attribution is off by default in Account privacy settings. Opting out removes all of that account's associations from this report; opting back in does not backfill old clicks. These figures must not be presented as click-through conversion rates, causal effects, or a total of all Hustle customers.</p>
      </section>

      <Timeline snapshot={snapshot}/>

      <section aria-labelledby="discovery-observations" className={styles.section}>
        <div className={styles.sectionHeading}>
          <div><p className={styles.eyebrow}>03 / OBSERVATIONAL</p><h2 id="discovery-observations">Signals of discovery</h2></div>
          <span className={styles.observedPill}>Client-reported activity</span>
        </div>
        <p className={styles.sectionIntro}>{snapshot.observation.note}</p>
        <div className={styles.activityGrid}>
          {activityNames.map(item => <article className={styles.activityCard} key={item.id}>
            <span>{item.label}</span>
            <strong>{count(activity[item.id])}</strong>
            <p>{item.description}</p>
          </article>)}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="growth-signals">
        <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>04 / ECOSYSTEM</p><h2 id="growth-signals">Supply and connections</h2></div></div>
        <div className={styles.supplyGrid}>
          <Metric label="New accounts" value={snapshot.authoritative.newAccounts} help="New Hustle identities"/>
          <Metric label="Published professional profiles" value={snapshot.authoritative.publishedProfiles} help="Currently published; publication fell in window"/>
          <Metric label="Published Posts" value={snapshot.authoritative.publishedPosts} help="Currently published proof of work"/>
          <Metric label="New follows" value={snapshot.authoritative.newFollows} help="Current relationships formed in this window"/>
        </div>
      </section>

      <section className={styles.explainer} aria-labelledby="interpretation">
        <p className={styles.eyebrow}>MEASUREMENT INTEGRITY</p>
        <h2 id="interpretation">What these numbers do—and don't—prove.</h2>
        <p>These are useful operational indicators, not a cohort conversion funnel. We cannot yet prove that a particular Post view caused a Booking or that a paid Order began with a specific piece of content.</p>
        <ul>
          {snapshot.cautions.map(text => <li key={text}>{text}</li>)}
        </ul>
        <p>Next: join privacy-safe, consent-aware user journeys to measure actual time-to-first-opportunity and conversion pathways without exposing sensitive customer details.</p>
      </section>
    </>}
  </main>;
}
