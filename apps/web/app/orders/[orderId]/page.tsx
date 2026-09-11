"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { formatMoney, getOrder, type OrderRecord } from "../../../lib/commerce";
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

  useEffect(() => {
    if (!params?.orderId) return;
    getOrder(params.orderId).then(setOrder).catch((reason: Error) => setError(reason.message));
  }, [params?.orderId]);

  if (error) return <main className={styles.shell}><div className={styles.error}>{error}</div><p><a className={styles.link} href="/orders">← Orders</a></p></main>;
  if (!order) return <main className={styles.shell}><div className={styles.loading}>Loading Order…</div></main>;

  const counterpart = order.viewerRole === "BUYER" ? order.seller : order.buyer;
  const created = search.get("created") === "1";
  const hasPhysical = order.items.some((item) => item.productTypeSnapshot === "PHYSICAL");

  return <main className={styles.shell}>
    <header className={styles.header}>
      <a className={styles.brand} href="/">HUSTLE↗</a>
      <nav className={styles.nav}><a href="/orders">Orders</a><a href="/cart">Cart</a><a href="/marketplace">Marketplace</a><a href="/messages">Messages</a></nav>
    </header>

    <section className={styles.hero}>
      <div><p className={styles.eyebrow}>ORDER · {order.viewerRole}</p><h1>{order.status.replaceAll("_", " ")}</h1></div>
      <p>{order.nextAction}</p>
    </section>

    {created && <div className={styles.success}>Order created successfully. It is PENDING and has not been paid yet.</div>}

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
        <div className={styles.notice}><strong>{order.paymentBoundary.paid ? "Payment confirmed" : "Payment not confirmed"}</strong><p>{order.paymentBoundary.message}</p></div>
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
