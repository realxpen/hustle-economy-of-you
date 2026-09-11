"use client";

import { useCallback, useEffect, useState } from "react";
import { formatMoney, listBuyerOrders, listSellerOrders, type OrderPage, type OrderRecord } from "../../lib/commerce";
import styles from "../commerce.module.css";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function OrderCard({ order }: { order: OrderRecord }) {
  const counterpart = order.viewerRole === "BUYER" ? order.seller : order.buyer;
  return <a className={styles.card} href={`/orders/${order.id}`}>
    <div className={styles.cardTop}>
      <div><small className={styles.eyebrow}>{order.viewerRole === "BUYER" ? "PURCHASE" : "SALE"}</small><h3>{order.items[0]?.productTitleSnapshot ?? "Order"}{order.items.length > 1 ? ` +${order.items.length - 1}` : ""}</h3></div>
      <span className={styles.status}>{order.status}</span>
    </div>
    <div className={styles.meta}><span>{formatMoney(order.totalMinor, order.currency)}</span><span>{formatDate(order.createdAt)}</span><span>{counterpart.displayName ?? counterpart.username ?? "Hustle user"}</span></div>
    <p>{order.nextAction}</p>
  </a>;
}

function OrderSection({ title, eyebrow, page, error }: { title: string; eyebrow: string; page: OrderPage | null; error: string | null }) {
  return <section className={styles.panel}>
    <div className={styles.sectionTitle}><div><small className={styles.eyebrow}>{eyebrow}</small><h2>{title}</h2></div>{page && <small>{page.items.length} loaded</small>}</div>
    {error && <div className={styles.error}>{error}</div>}
    {!error && !page && <div className={styles.empty}>Loading orders…</div>}
    {!error && page && page.items.length === 0 && <div className={styles.empty}>Nothing here yet.</div>}
    {page && page.items.length > 0 && <div className={styles.list}>{page.items.map((order) => <OrderCard key={order.id} order={order} />)}</div>}
  </section>;
}

export default function OrdersPage() {
  const [buyer, setBuyer] = useState<OrderPage | null>(null);
  const [seller, setSeller] = useState<OrderPage | null>(null);
  const [buyerError, setBuyerError] = useState<string | null>(null);
  const [sellerError, setSellerError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [buyerResult, sellerResult] = await Promise.allSettled([listBuyerOrders(), listSellerOrders()]);
    if (buyerResult.status === "fulfilled") setBuyer(buyerResult.value);
    else setBuyerError(buyerResult.reason instanceof Error ? buyerResult.reason.message : "Could not load purchases");
    if (sellerResult.status === "fulfilled") setSeller(sellerResult.value);
    else setSellerError(sellerResult.reason instanceof Error ? sellerResult.reason.message : "Could not load sales");
  }, []);

  useEffect(() => { void load(); }, [load]);

  return <main className={styles.shell}>
    <header className={styles.header}>
      <a className={styles.brand} href="/">HUSTLE↗</a>
      <nav className={styles.nav}><a href="/home">Home</a><a href="/marketplace">Marketplace</a><a href="/cart">Cart</a><a href="/messages">Messages</a><a href="/account">Account</a></nav>
    </header>

    <section className={styles.hero}>
      <div><p className={styles.eyebrow}>PHASE 12 · ORDERS</p><h1>Commerce, one identity.</h1></div>
      <p>Your purchases and Product sales live together. There is no buyer/seller role switch—only the relationship you have to each Order.</p>
    </section>

    <div className={styles.grid}>
      <OrderSection title="Your purchases" eyebrow="AS BUYER" page={buyer} error={buyerError} />
      <OrderSection title="Orders for your products" eyebrow="AS SELLER" page={seller} error={sellerError} />
    </div>

    <footer className={styles.footer}><span>PENDING Orders are durable checkout attempts.</span><strong>PAID requires Phase 13 financial confirmation.</strong></footer>
  </main>;
}
