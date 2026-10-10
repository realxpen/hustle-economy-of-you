"use client";

import { ExperienceStatus } from "../../components/navigation/experience-status";
import { ExperienceHeader } from "../../components/navigation/experience-header";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatMoney, listBuyerOrders, listSellerOrders, type OrderPage, type OrderRecord } from "../../lib/commerce";
import styles from "../commerce.module.css";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function OrderCard({ order }: { order: OrderRecord }) {
  const counterpart = order.viewerRole === "BUYER" ? order.seller : order.buyer;
  return <Link className={[styles.card, "h-experience-surface"].join(" ")} href={`/orders/${order.id}`}>
    <div className={styles.cardTop}>
      <div><small className={styles.eyebrow}>{order.viewerRole === "BUYER" ? "PURCHASE" : "SALE"}</small><h3>{order.items[0]?.productTitleSnapshot ?? "Order"}{order.items.length > 1 ? ` +${order.items.length - 1}` : ""}</h3></div>
      <ExperienceStatus kind="order" value={order.status} />
    </div>
    <div className={styles.meta}><span>{formatMoney(order.totalMinor, order.currency)}</span><span>{formatDate(order.createdAt)}</span><span>{counterpart.displayName ?? counterpart.username ?? "Hustle user"}</span></div>
    <p>{order.nextAction}</p>
  </Link>;
}

function OrderSection({ title, eyebrow, page, error }: { title: string; eyebrow: string; page: OrderPage | null; error: string | null }) {
  return <section className={[styles.panel, "h-experience-surface"].join(" ")}>
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

  return <main className={[styles.shell, "h-experience-shell"].join(" ")}>
    <ExperienceHeader section="Orders" secondaryLinks={[{ href: "/cart", label: "Your cart ↗" }, { href: "/marketplace", label: "Browse offers" }]} />

    <section className={[styles.hero, "h-experience-hero"].join(" ")}>
      <div><p className={styles.eyebrow}>ORDER MANAGER</p><h1 className="h-experience-heading">Commerce, one identity.</h1></div>
      <p>Your purchases and Product sales live together. There is no buyer/seller role switch—only the relationship you have to each Order.</p>
    </section>

    <div className={styles.grid}>
      <OrderSection title="Your purchases" eyebrow="AS BUYER" page={buyer} error={buyerError} />
      <OrderSection title="Orders for your products" eyebrow="AS SELLER" page={seller} error={sellerError} />
    </div>

    <footer className={styles.footer}><span>PENDING Orders are durable checkout attempts.</span><strong>PAID means provider-confirmed funding, never a self-reported payment.</strong></footer>
  </main>;
}
