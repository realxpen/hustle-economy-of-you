"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  getAdminApplicationQueues,
  getAdminFinancialSnapshot,
  getAdminUserDetail,
  getOperationsOverview,
  listAdminAuditEvents,
  listAdminBookings,
  listAdminOrders,
  searchAdminUsers,
  suspendAdminCapability,
  reactivateAdminCapability,
  type AdminApplicationQueues,
  type AdminAuditEvent,
  type AdminBookingItem,
  type AdminFinancialSnapshot,
  type AdminOrderItem,
  type AdminUserDetail,
  type AdminUserListItem,
  type OperationsOverview
} from "../lib/admin-api";

const TOKEN_KEY = "hustle-admin-access-token";

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function money(value: number, currency = "NGN") {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(value / 100);
}

function name(user: {
  displayName: string | null;
  username: string | null;
}) {
  return user.displayName ?? (user.username ? `@${user.username}` : "Hustle user");
}

function count(record: Record<string, number>, key: string) {
  return record[key] ?? 0;
}

export default function AdminOperationsHome() {
  const [token, setToken] = useState("");
  const [tokenDraft, setTokenDraft] = useState("");
  const [overview, setOverview] = useState<OperationsOverview | null>(null);
  const [applications, setApplications] = useState<AdminApplicationQueues | null>(null);
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [selectedUser, setSelectedUser] = useState<AdminUserDetail | null>(null);
  const [bookings, setBookings] = useState<AdminBookingItem[]>([]);
  const [orders, setOrders] = useState<AdminOrderItem[]>([]);
  const [finance, setFinance] = useState<AdminFinancialSnapshot | null>(null);
  const [audit, setAudit] = useState<AdminAuditEvent[]>([]);
  const [userQuery, setUserQuery] = useState("");
  const [auditQuery, setAuditQuery] = useState("");
  const [bookingStatus, setBookingStatus] = useState("");
  const [orderStatus, setOrderStatus] = useState("");
  const [capabilityReason, setCapabilityReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const existing = window.sessionStorage.getItem(TOKEN_KEY) ?? "";
    setToken(existing);
    setTokenDraft(existing);
  }, []);

  useEffect(() => {
    if (token) void loadOperations(token);
  }, [token]);

  async function loadOperations(nextToken = token) {
    if (!nextToken) return;
    setLoading(true);
    setError(null);
    try {
      const [
        nextOverview,
        nextApplications,
        nextUsers,
        nextBookings,
        nextOrders,
        nextFinance,
        nextAudit
      ] = await Promise.all([
        getOperationsOverview(nextToken),
        getAdminApplicationQueues(nextToken, 30),
        searchAdminUsers(nextToken, "", 30),
        listAdminBookings(nextToken, undefined, 30),
        listAdminOrders(nextToken, undefined, 30),
        getAdminFinancialSnapshot(nextToken, 25),
        listAdminAuditEvents(nextToken, "", 80)
      ]);
      setOverview(nextOverview);
      setApplications(nextApplications);
      setUsers(nextUsers);
      setBookings(nextBookings);
      setOrders(nextOrders);
      setFinance(nextFinance);
      setAudit(nextAudit);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load Hustle operations");
    } finally {
      setLoading(false);
    }
  }

  function saveToken() {
    const next = tokenDraft.trim();
    if (!next) return;
    window.sessionStorage.setItem(TOKEN_KEY, next);
    setToken(next);
    setNotice("Admin session stored only for this browser tab session.");
  }

  function clearToken() {
    window.sessionStorage.removeItem(TOKEN_KEY);
    setToken("");
    setTokenDraft("");
    setOverview(null);
    setApplications(null);
    setUsers([]);
    setSelectedUser(null);
    setBookings([]);
    setOrders([]);
    setFinance(null);
    setAudit([]);
  }

  async function searchUsers(event?: FormEvent) {
    event?.preventDefault();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      setUsers(await searchAdminUsers(token, userQuery, 60));
      setSelectedUser(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "User search failed");
    } finally {
      setLoading(false);
    }
  }

  async function inspectUser(userId: string) {
    if (!token) return;
    setDetailLoading(true);
    setError(null);
    try {
      setSelectedUser(await getAdminUserDetail(token, userId));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load user operations detail");
    } finally {
      setDetailLoading(false);
    }
  }

  async function changeCapability(
    capability: "HUSTLER" | "AGENT",
    mode: "SUSPEND" | "REACTIVATE"
  ) {
    if (!token || !selectedUser || !capabilityReason.trim()) {
      setError("Add an operational reason before changing capability status.");
      return;
    }
    setDetailLoading(true);
    setError(null);
    setNotice(null);
    try {
      const next = mode === "SUSPEND"
        ? await suspendAdminCapability(token, selectedUser.user.id, capability, capabilityReason.trim())
        : await reactivateAdminCapability(token, selectedUser.user.id, capability, capabilityReason.trim());
      setSelectedUser(next);
      setCapabilityReason("");
      setNotice(`${capability} ${mode === "SUSPEND" ? "suspended" : "reactivated"} with an audit event.`);
      setUsers(await searchAdminUsers(token, userQuery, 60));
      setOverview(await getOperationsOverview(token));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Capability operation failed");
    } finally {
      setDetailLoading(false);
    }
  }

  async function filterBookings(value: string) {
    setBookingStatus(value);
    if (!token) return;
    setLoading(true);
    try {
      setBookings(await listAdminBookings(token, value || undefined, 50));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not filter bookings");
    } finally {
      setLoading(false);
    }
  }

  async function filterOrders(value: string) {
    setOrderStatus(value);
    if (!token) return;
    setLoading(true);
    try {
      setOrders(await listAdminOrders(token, value || undefined, 50));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not filter orders");
    } finally {
      setLoading(false);
    }
  }

  async function searchAudit(event: FormEvent) {
    event.preventDefault();
    if (!token) return;
    setLoading(true);
    try {
      setAudit(await listAdminAuditEvents(token, auditQuery, 150));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not filter audit events");
    } finally {
      setLoading(false);
    }
  }

  const financeNeedsAttention = useMemo(() => {
    if (!overview) return 0;
    return (
      count(overview.finance.paymentAttempts, "PENDING") +
      count(overview.finance.paymentAttempts, "FAILED") +
      count(overview.finance.payouts, "REQUESTED") +
      count(overview.finance.payouts, "FAILED") +
      count(overview.finance.refunds, "REQUESTED") +
      count(overview.finance.refunds, "FAILED")
    );
  }, [overview]);

  if (!token) {
    return <main className="admin-shell auth-shell">
      <section className="auth-card">
        <p className="eyebrow">HUSTLE / OPERATIONS</p>
        <h1>Run the marketplace.</h1>
        <p>
          Phase 19A is a read-oriented operating console. It exposes authoritative marketplace
          state without granting money-moving or suspension actions.
        </p>
        <label className="field">
          <span>ADMIN ACCESS TOKEN</span>
          <textarea
            rows={5}
            value={tokenDraft}
            onChange={(event) => setTokenDraft(event.target.value)}
            placeholder="Paste the current authenticated admin bearer token"
          />
        </label>
        <button className="primary" type="button" onClick={saveToken} disabled={!tokenDraft.trim()}>
          Open operations
        </button>
      </section>
    </main>;
  }

  return <main className="admin-shell">
    <header className="topbar">
      <div>
        <p className="eyebrow">HUSTLE / MARKETPLACE OPERATIONS</p>
        <h1>One control plane.<br/>No database archaeology.</h1>
        <p className="subtitle">
          Users, applications, bookings, orders, financial state, moderation signals and durable audit events.
          Phase 19A is visibility-first: no direct payment, escrow or suspension mutation is exposed here.
        </p>
      </div>
      <div className="top-actions">
        <a className="secondary" href="/appeals">Appeals</a>
        <a className="secondary" href="/moderation">Moderation</a>
        <a className="secondary" href="/cases">Cases</a>
        <a className="secondary" href="/applications">Applications</a>
        <a className="secondary" href="/trust-safety">Trust & Safety</a>
        <button className="secondary" type="button" onClick={() => void loadOperations()} disabled={loading}>Refresh</button>
        <button className="danger" type="button" onClick={clearToken}>End session</button>
      </div>
    </header>

    {error && <div className="banner error">{error}</div>}
    {notice && <div className="banner success">{notice}</div>}

    {overview && <section className="ops-metrics">
      <article><span>Total users</span><strong>{overview.users.total}</strong><small>{count(overview.users.activeCapabilities, "HUSTLER")} Hustlers · {count(overview.users.activeCapabilities, "AGENT")} Agents</small></article>
      <article><span>Needs review</span><strong>{overview.applications.needsReview}</strong><small>Hustler + Agent applications</small></article>
      <article><span>Open bookings</span><strong>{count(overview.marketplace.bookings, "REQUESTED") + count(overview.marketplace.bookings, "PAYMENT_PENDING") + count(overview.marketplace.bookings, "FUNDED") + count(overview.marketplace.bookings, "IN_PROGRESS")}</strong><small>Request through active work</small></article>
      <article><span>Open orders</span><strong>{count(overview.marketplace.orders, "PENDING") + count(overview.marketplace.orders, "PAID") + count(overview.marketplace.orders, "PROCESSING") + count(overview.marketplace.orders, "SHIPPED")}</strong><small>Pending through fulfillment</small></article>
      <article><span>Finance attention</span><strong>{financeNeedsAttention}</strong><small>Pending/failed operations</small></article>
      <article><span>Safety unresolved</span><strong>{overview.safety.unresolved}</strong><small><a href="/trust-safety">Open moderation →</a></small></article>
      <article><span>Published surfaces</span><strong>{overview.content.posts + overview.content.stories + overview.content.liveSessions}</strong><small>{overview.content.posts} posts · {overview.content.stories} stories · {overview.content.liveSessions} Live</small></article>
      <article><span>Audit events</span><strong>{overview.audit.systemEvents}</strong><small>Durable system history</small></article>
    </section>}

    <section className="ops-section">
      <div className="section-head">
        <div><p className="eyebrow">APPLICATIONS</p><h2>Capability queues</h2></div>
        <a className="secondary" href="/applications">Open review workspace →</a>
      </div>
      <div className="ops-grid two">
        <article className="ops-card">
          <div className="card-title"><strong>Hustler applications</strong><span>{applications?.hustler.length ?? 0}</span></div>
          <div className="table-list">
            {applications?.hustler.map((item) => <div className="table-row" key={item.id}>
              <div><strong>{name(item.user)}</strong><small>@{item.user.username ?? "user"} · {item.primarySkill ?? "Skill not set"}</small></div>
              <div><span className="pill">{item.status}</span><small>{item.identityVerificationStatus}</small></div>
              <time>{formatDate(item.submittedAt)}</time>
            </div>)}
            {!applications?.hustler.length && <div className="empty">No Hustler applications waiting.</div>}
          </div>
        </article>
        <article className="ops-card">
          <div className="card-title"><strong>Agent applications</strong><span>{applications?.agent.length ?? 0}</span></div>
          <div className="table-list">
            {applications?.agent.map((item) => <div className="table-row" key={item.id}>
              <div><strong>{name(item.user)}</strong><small>@{item.user.username ?? "user"} · {item.operatingArea ?? "Area not set"}</small></div>
              <div><span className="pill">{item.status}</span><small>{item.identityVerificationStatus}</small></div>
              <time>{formatDate(item.submittedAt)}</time>
            </div>)}
            {!applications?.agent.length && <div className="empty">No Agent applications waiting.</div>}
          </div>
        </article>
      </div>
    </section>

    <section className="ops-section">
      <div className="section-head">
        <div><p className="eyebrow">USERS + CAPABILITIES</p><h2>Find any Hustle identity</h2></div>
      </div>
      <form className="ops-search" onSubmit={searchUsers}>
        <input value={userQuery} onChange={(event) => setUserQuery(event.target.value)} placeholder="Search username, name, email, phone or exact user ID" />
        <button className="primary" disabled={loading}>Search</button>
        {userQuery && <button className="secondary" type="button" onClick={() => { setUserQuery(""); void searchAdminUsers(token, "", 30).then(setUsers); }}>Clear</button>}
      </form>
      <div className="ops-grid user-grid">
        <article className="ops-card user-list-card">
          <div className="table-list">
            {users.map((user) => <button className="user-row" type="button" key={user.id} onClick={() => void inspectUser(user.id)}>
              <div><strong>{name(user)}</strong><small>@{user.username ?? "user"} · {user.location ?? "No location"}</small></div>
              <div className="capability-inline">{user.capabilities.map((capability) => <span key={capability.capability} className="pill">{capability.capability} · {capability.status}</span>)}</div>
            </button>)}
          </div>
        </article>
        <aside className="ops-card detail-card">
          {!selectedUser && <div className="empty">Choose a user to inspect capability and marketplace context.</div>}
          {detailLoading && <div className="empty">Loading user detail…</div>}
          {selectedUser && !detailLoading && <div className="detail-stack">
            <div>
              <p className="eyebrow">IDENTITY</p>
              <h3>{name(selectedUser.user)}</h3>
              <p>@{selectedUser.user.username ?? "user"} · {selectedUser.user.email ?? selectedUser.user.phone ?? "No contact"}</p>
            </div>
            <div className="capability-inline">{selectedUser.user.capabilities.map((capability) => <span className="pill" key={capability.capability}>{capability.capability} · {capability.status}</span>)}</div>
            <dl className="ops-dl">
              <div><dt>Bookings</dt><dd>{selectedUser.activity.bookings.asClient} client / {selectedUser.activity.bookings.asHustler} Hustler</dd></div>
              <div><dt>Orders</dt><dd>{selectedUser.activity.orders.asBuyer} buyer / {selectedUser.activity.orders.asSeller} seller</dd></div>
              <div><dt>Content</dt><dd>{selectedUser.activity.content.posts} posts · {selectedUser.activity.content.services} services · {selectedUser.activity.content.products} products</dd></div>
              <div><dt>Conversations</dt><dd>{selectedUser.activity.conversations}</dd></div>
              <div><dt>Reports received</dt><dd>{selectedUser.trustSafety.reportsReceived}</dd></div>
              <div><dt>Blocks</dt><dd>{selectedUser.trustSafety.blocksCreated} created / {selectedUser.trustSafety.blocksReceived} received</dd></div>
              <div><dt>Agent work</dt><dd>{selectedUser.agent.activeRepresentationsAsAgent} represented / {selectedUser.agent.activeAgentsRepresentingUser} Agents helping</dd></div>
              <div><dt>Verified reviews</dt><dd>{selectedUser.user.reputation?.verifiedReviewCount ?? 0}</dd></div>
            </dl>

            <section className="capability-ops">
              <p className="eyebrow">CAPABILITY OPERATIONS</p>
              <p className="policy-copy">
                Phase 19B only permits reversible HUSTLER/AGENT suspension. CLIENT bans and permanent revocation remain outside this slice.
              </p>
              <label className="field">
                <span>REQUIRED OPERATIONAL REASON</span>
                <textarea rows={3} value={capabilityReason} onChange={(event) => setCapabilityReason(event.target.value)} placeholder="Policy/evidence reason for suspension or reactivation" />
              </label>
              {(["HUSTLER","AGENT"] as const).map((capability) => {
                const record = selectedUser.user.capabilities.find((item) => item.capability === capability);
                if (!record) return null;
                return <div className="capability-op-row" key={capability}>
                  <div><strong>{capability}</strong><span className="pill">{record.status}</span></div>
                  {record.status === "ACTIVE"
                    ? <button className="danger" disabled={detailLoading || !capabilityReason.trim()} onClick={() => void changeCapability(capability, "SUSPEND")}>Suspend</button>
                    : record.status === "SUSPENDED"
                      ? <button className="primary" disabled={detailLoading || !capabilityReason.trim()} onClick={() => void changeCapability(capability, "REACTIVATE")}>Reactivate</button>
                      : <small>REVOKED is not reversible in Phase 19B.</small>}
                </div>;
              })}
            </section>
          </div>}
        </aside>
      </div>
    </section>

    <section className="ops-section">
      <div className="section-head">
        <div><p className="eyebrow">MARKETPLACE</p><h2>Bookings + orders</h2></div>
      </div>
      <div className="ops-grid two">
        <article className="ops-card">
          <div className="card-title">
            <strong>Bookings</strong>
            <select value={bookingStatus} onChange={(event) => void filterBookings(event.target.value)}>
              <option value="">All statuses</option>
              {["REQUESTED","ACCEPTED","PAYMENT_PENDING","FUNDED","IN_PROGRESS","COMPLETED","CANCELLED","DECLINED","DISPUTED","REFUNDED","CLOSED"].map((status) => <option key={status}>{status}</option>)}
            </select>
          </div>
          <div className="table-list">
            {bookings.map((booking) => <div className="transaction-row" key={booking.id}>
              <div><strong>{booking.serviceTitleSnapshot}</strong><small>{name(booking.client)} → {name(booking.hustler)}</small><small><a href={`/cases?subjectType=BOOKING&subjectId=${encodeURIComponent(booking.id)}`}>Investigate Booking →</a></small></div>
              <div><span className="pill">{booking.status}</span><small>{money(booking.agreedPriceMinor, booking.currency)}</small></div>
              <time>{formatDate(booking.createdAt)}</time>
            </div>)}
          </div>
        </article>
        <article className="ops-card">
          <div className="card-title">
            <strong>Orders</strong>
            <select value={orderStatus} onChange={(event) => void filterOrders(event.target.value)}>
              <option value="">All statuses</option>
              {["PENDING","PAID","PROCESSING","SHIPPED","DELIVERED","COMPLETED","CANCELLED","REFUNDED"].map((status) => <option key={status}>{status}</option>)}
            </select>
          </div>
          <div className="table-list">
            {orders.map((order) => <div className="transaction-row" key={order.id}>
              <div><strong>{name(order.buyer)} → {name(order.seller)}</strong><small>{order._count.items} item{order._count.items === 1 ? "" : "s"}</small><small><a href={`/cases?subjectType=ORDER&subjectId=${encodeURIComponent(order.id)}`}>Investigate Order →</a></small></div>
              <div><span className="pill">{order.status}</span><small>{money(order.totalMinor, order.currency)}</small></div>
              <time>{formatDate(order.createdAt)}</time>
            </div>)}
          </div>
        </article>
      </div>
    </section>

    {finance && <section className="ops-section">
      <div className="section-head">
        <div><p className="eyebrow">FINANCE</p><h2>Authoritative financial state</h2></div>
        <span className="read-only-tag">NO MONEY-MOVING CONTROLS IN 19A</span>
      </div>
      <div className="ops-grid four">
        <FinanceCard title="Payments" items={finance.payments.map((item) => ({ id:item.id, label:`${item.subjectType} · ${item.subjectId}`, status:item.status, value:money(item.amountMinor,item.currency), detail:item.provider }))}/>
        <FinanceCard title="Escrow" items={finance.escrows.map((item) => ({ id:item.id, label:`${item.subjectType} · ${item.subjectId}`, status:item.status, value:money(item.amountMinor,item.currency), detail:item.beneficiaryUserId }))}/>
        <FinanceCard title="Payouts" items={finance.payouts.map((item) => ({ id:item.id, label:item.userId, status:item.status, value:money(item.amountMinor,item.currency), detail:item.provider }))}/>
        <FinanceCard title="Refunds" items={finance.refunds.map((item) => ({ id:item.id, label:`${item.subjectType} · ${item.subjectId}`, status:item.status, value:money(item.amountMinor,item.currency), detail:item.requestedByUserId ?? "System" }))}/>
      </div>
    </section>}

    <section className="ops-section">
      <div className="section-head">
        <div><p className="eyebrow">AUDIT</p><h2>System event history</h2></div>
      </div>
      <form className="ops-search" onSubmit={searchAudit}>
        <input value={auditQuery} onChange={(event) => setAuditQuery(event.target.value)} placeholder="Filter event names, e.g. agent., booking., payment." />
        <button className="primary" disabled={loading}>Filter</button>
      </form>
      <article className="ops-card audit-card">
        <div className="table-list">
          {audit.map((event) => <details className="audit-row" key={event.id}>
            <summary><div><strong>{event.name}</strong><small>{event.source}</small></div><time>{formatDate(event.occurredAt)}</time></summary>
            <pre>{JSON.stringify(event.payload, null, 2)}</pre>
          </details>)}
        </div>
      </article>
    </section>
  </main>;
}

function FinanceCard({
  title,
  items
}: {
  title: string;
  items: Array<{ id:string; label:string; status:string; value:string; detail:string }>;
}) {
  return <article className="ops-card finance-card">
    <div className="card-title"><strong>{title}</strong><span>{items.length}</span></div>
    <div className="table-list">
      {items.slice(0, 12).map((item) => <div className="finance-row" key={item.id}>
        <div><strong>{item.value}</strong><small>{item.label}</small></div>
        <div><span className="pill">{item.status}</span><small>{item.detail}</small></div>
      </div>)}
      {!items.length && <div className="empty">No recent records.</div>}
    </div>
  </article>;
}
