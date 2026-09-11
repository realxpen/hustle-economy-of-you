"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  cancelOrder,
  completeOrder,
  deliverOrder,
  formatMoney,
  getOrder,
  processOrder,
  shipOrder,
  type OrderRecord
} from "../../../lib/commerce";
import styles from "../../commerce.module.css";

function formatDate(value: string | null) {
  if (!value) return "Not yet";
  return new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function OrderDetailPage() {
  const params = useParams<{ orderId: string }>();
  const search = useSearchParams();
  const [order, setOrder] = useState<OrderRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!params?.orderId) return;
    getOrder(params.orderId).then(setOrder).catch((reason: Error) => setError(reason.message));
  }, [params?.orderId]);

  const hasPhysical = useMemo(
    () => order?.items.some((item) => item.productTypeSnapshot === "PHYSICAL") ?? false,
    [order]
  );

  async function runAction(
    label: string,
    action: (orderId: string) => Promise<OrderRecord>,
    confirmation?: string
  ) {
    if (!order || busy) return;
    if (confirmation && !window.confirm(confirmation)) return;
    setBusy(label);
    setError(null);
    setNotice(null);
    try {
      const updated = await action(order.id);
      setOrder(updated);
      setNotice(`${label} recorded successfully.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update Order");
    } finally {
      setBusy(null);
    }
  }

  if (error && !order) return <main className={styles.shell}><div className={styles.error}>{error}</div><p><a className={styles.link} href="/orders">← Orders</a></p></main>;
  if (!order) return <main className={styles.shell}><div className={styles.loading}>Loading Order…</div></main>;

  const counterpart = order.viewerRole === "BUYER" ? order.seller : order.buyer;
  const created = search.get("created") === "1";
  const canCancel = order.status === "PENDING";
  const canProcess = order.viewerRole === "SELLER" && order.status === "PAID";
  const canShip = order.viewerRole === "SELLER" && hasPhysical && order.status === "PROCESSING";
  const canDeliver = order.viewerRole === "SELLER" && (
    (hasPhysical && order.status === "SHIPPED") || (!hasPhysical && order.status === "PROCESSING")
  );
  const canComplete = order.viewerRole === "BUYER" && order.status === "DELIVERED";

  const derivedNextAction = order.nextAction ?? (
    order.status === "PAID" ? (order.viewerRole === "SELLER" ? "Start processing this paid Order." : "The seller can now begin processing.") :
    order.status === "PROCESSING" ? (order.viewerRole === "SELLER" ? (hasPhysical ? "Mark the Order shipped when it leaves you." : "Mark the digital Order delivered when access is provided.") : "The seller is fulfilling this Order.") :
    order.status === "SHIPPED" ? (order.viewerRole === "SELLER" ? "Mark the Order delivered after confirmed delivery." : "Your Order is on the way.") :
    order.status === "DELIVERED" ? (order.viewerRole === "BUYER" ? "Confirm completion after you have received the Order." : "Waiting for buyer completion confirmation.") :
    order.status === "COMPLETED" ? "This Order is complete." :
    order.status === "CANCELLED" ? "This Order was cancelled before payment." :
    order.status === "REFUNDED" ? "This Order was refunded through authoritative payment handling." : null
  );

  return <main className={styles.shell}>
    <header className={styles.header}>
      <a className={styles.brand} href="/">HUSTLE↗</a>
      <nav className={styles.nav}><a href="/orders">Orders</a><a href="/cart">Cart</a><a href="/marketplace">Marketplace</a><a href="/messages">Messages</a></nav>
    </header>

    <section className={styles.hero}>
      <div><p className={styles.eyebrow}>ORDER · {order.viewerRole}</p><h1>{order.status.replaceAll("_", " ")}</h1></div>
      <p>{derivedNextAction}</p>
    </section>

    {created && order.status === "PENDING" && <div className={styles.success}>Order created successfully. It is PENDING and has not been paid yet.</div>}
    {notice && <div className={styles.success}>{notice}</div>}
    {error && <div className={styles.error}>{error}</div>}

    {(canCancel || canProcess || canShip || canDeliver || canComplete) && <section className={styles.panel} style={{ marginTop: 18 }}>
      <div className={styles.sectionTitle}>
        <div><small className={styles.eyebrow}>AVAILABLE ACTION</small><h2>Move the transaction forward</h2></div>
      </div>
      <div className={styles.row}>
        {canProcess && <button className={styles.buttonAlt} disabled={Boolean(busy)} onClick={() => void runAction("Processing", processOrder)}>{busy === "Processing" ? "Updating…" : "Start processing"}</button>}
        {canShip && <button className={styles.buttonAlt} disabled={Boolean(busy)} onClick={() => void runAction("Shipment", shipOrder)}>{busy === "Shipment" ? "Updating…" : "Mark shipped"}</button>}
        {canDeliver && <button className={styles.buttonAlt} disabled={Boolean(busy)} onClick={() => void runAction("Delivery", deliverOrder)}>{busy === "Delivery" ? "Updating…" : "Mark delivered"}</button>}
        {canComplete && <button className={styles.button} disabled={Boolean(busy)} onClick={() => void runAction("Completion", completeOrder, "Confirm that you have received this Order and want to mark it complete?")}>{busy === "Completion" ? "Updating…" : "Confirm completion"}</button>}
        {canCancel && <button className={styles.danger} disabled={Boolean(busy)} onClick={() => void runAction("Cancellation", cancelOrder, "Cancel this unpaid PENDING Order? This does not perform any refund because no payment has been confirmed.")}>{busy === "Cancellation" ? "Cancelling…" : "Cancel unpaid Order"}</button>}
      </div>
      {order.status === "PENDING" && <div className={styles.notice} style={{ marginTop: 14 }}><strong>Before payment only</strong><p>Phase 12 permits cancellation only while the Order is PENDING. Once payment is authoritative, refund execution belongs to Phase 13.</p></div>}
    </section>}

    <div className={styles.grid} style={{ marginTop: 18 }}>
      <section className={styles.panel}>
        <div className={styles.sectionTitle}><div><small className={styles.eyebrow}>ITEM SNAPSHOT</small><h2>What was ordered</h2></div><span className={styles.status}>{order.status}</span></div>
        <div className={styles.list}>{order.items.map((item) => <article className={styles.card} key={item.id}>
          <div className={styles.cardTop}><div><small className={styles.eyebrow}>{item.productTypeSnapshot}</small><h3><a href={`/products/${item.productId}`}>{item.productTitleSnapshot}</a></h3><div className={styles.meta}><span>{item.variantNameSnapshot ?? "Standard"}</span>{item.skuSnapshot && <span>{item.skuSnapshot}</span>}<span>Qty {item.quantity}</span></div></div><strong className={styles.price}>{formatMoney(item.lineTotalMinor, order.currency)}</strong></div>
          <div className={styles.meta}><span>{formatMoney(item.unitPriceMinor, order.currency)} each</span><span>Inventory source: {item.inventorySource}</span></div>
        </article>)}</div>
      </section>

      <aside className={`${styles.panel} ${styles.summary}`}>
        <div><small className={styles.eyebrow}>{order.viewerRole === "BUYER" ? "SELLER" : "BUYER"}</small><h2>{counterpart.displayName ?? `@${counterpart.username}`}</h2><p>@{counterpart.username ?? "hustle-user"}</p></div>
        <div className={styles.summaryLine}><span>Total</span><strong>{formatMoney(order.totalMinor, order.currency)}</strong></div>
        <div className={styles.summaryLine}><span>Created</span><strong>{formatDate(order.createdAt)}</strong></div>
        <div className={styles.notice}><strong>{order.paymentBoundary.paid ? "Payment confirmed" : "Payment not confirmed"}</strong><p>{order.paymentBoundary.message ?? (order.paymentBoundary.paid ? "Payment state is authoritative; fulfillment actions are server-controlled." : "")}</p></div>
        <a className={styles.button} href={`/messages/start?userId=${encodeURIComponent(counterpart.id)}`}>Message {order.viewerRole === "BUYER" ? "seller" : "buyer"} →</a>
      </aside>
    </div>

    <section className={styles.panel} style={{ marginTop: 18 }}>
      <div className={styles.sectionTitle}><div><small className={styles.eyebrow}>TRANSACTION STATE</small><h2>Order timeline</h2></div></div>
      <div className={styles.detailGrid}>
        <div className={styles.detailBlock}><small>CREATED</small><p>{formatDate(order.createdAt)}</p></div>
        <div className={styles.detailBlock}><small>PAID</small><p>{formatDate(order.paidAt)}</p></div>
        <div className={styles.detailBlock}><small>PROCESSING</small><p>{formatDate(order.processingAt)}</p></div>
        <div className={styles.detailBlock}><small>SHIPPED</small><p>{hasPhysical ? formatDate(order.shippedAt) : "Not required for digital-only orders"}</p></div>
        <div className={styles.detailBlock}><small>DELIVERED</small><p>{formatDate(order.deliveredAt)}</p></div>
        <div className={styles.detailBlock}><small>COMPLETED</small><p>{formatDate(order.completedAt)}</p></div>
        <div className={styles.detailBlock}><small>CANCELLED</small><p>{formatDate(order.cancelledAt)}</p></div>
        <div className={styles.detailBlock}><small>REFUNDED</small><p>{formatDate(order.refundedAt)}</p></div>
      </div>
    </section>

    {hasPhysical && <section className={styles.panel} style={{ marginTop: 18 }}>
      <div className={styles.sectionTitle}><div><small className={styles.eyebrow}>PRIVATE DELIVERY DATA</small><h2>Delivery details</h2></div></div>
      <div className={styles.detailGrid}>
        <div className={styles.detailBlock}><small>RECIPIENT</small><p>{order.deliveryName ?? "Not provided"}</p></div>
        <div className={styles.detailBlock}><small>PHONE</small><p>{order.deliveryPhone ?? "Not provided"}</p></div>
        <div className={styles.detailBlock}><small>ADDRESS</small><p>{[order.deliveryAddress, order.deliveryCity, order.deliveryState, order.deliveryCountry].filter(Boolean).join(", ") || "Not provided"}</p></div>
        <div className={styles.detailBlock}><small>NOTE</small><p>{order.deliveryNote ?? "No delivery note"}</p></div>
      </div>
    </section>}

    <footer className={styles.footer}><span>Order #{order.id}</span><strong>Financial state remains authoritative.</strong></footer>
  </main>;
}
