"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { checkout, formatMoney, getCheckoutPreview, type CheckoutInput, type CheckoutPreview } from "../../lib/commerce";
import styles from "../commerce.module.css";

export default function CheckoutPage() {
  const [preview, setPreview] = useState<CheckoutPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<CheckoutInput>({ deliveryCountry: "Nigeria" });

  useEffect(() => {
    getCheckoutPreview().then(setPreview).catch((reason: Error) => setError(reason.message));
  }, []);

  const requiresDelivery = useMemo(() => preview?.groups.some((group) => group.requiresDelivery) ?? false, [preview]);

  function setField<K extends keyof CheckoutInput>(field: K, value: CheckoutInput[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const result = await checkout(form);
      if (result.orders.length === 1) {
        window.location.assign(`/orders/${result.orders[0].id}?created=1`);
      } else {
        window.location.assign("/orders?checkout=success");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Checkout failed");
      try { setPreview(await getCheckoutPreview()); } catch { /* keep original checkout error */ }
    } finally { setSubmitting(false); }
  }

  return <main className={styles.shell}>
    <header className={styles.header}>
      <a className={styles.brand} href="/">HUSTLE↗</a>
      <nav className={styles.nav}><a href="/cart">Cart</a><a href="/orders">Orders</a><a href="/marketplace">Marketplace</a><a href="/account">Account</a></nav>
    </header>

    <section className={styles.hero}>
      <div><p className={styles.eyebrow}>PHASE 12 · CHECKOUT</p><h1>Confirm the transaction.</h1></div>
      <p>Checkout creates a durable PENDING Order. It does not charge you, reserve stock, or claim payment success.</p>
    </section>

    {error && <div className={styles.error}>{error}</div>}
    {!preview && !error && <div className={styles.loading}>Validating Cart…</div>}

    {preview && <form className={styles.grid} onSubmit={submit}>
      <section className={styles.panel}>
        <div className={styles.sectionTitle}><div><small className={styles.eyebrow}>ORDER PREVIEW</small><h2>{preview.groups.length} seller order{preview.groups.length === 1 ? "" : "s"}</h2></div></div>
        <div className={styles.list}>{preview.groups.map((group) => <article className={styles.card} key={`${group.seller.id}:${group.currency}`}>
          <div className={styles.cardTop}><div><small className={styles.eyebrow}>SELLER</small><h3>{group.seller.displayName ?? `@${group.seller.username}`}</h3><div className={styles.meta}><span>@{group.seller.username}</span><span>{group.requiresDelivery ? "Physical delivery" : "Digital fulfillment"}</span></div></div><strong className={styles.price}>{formatMoney(group.subtotalMinor, group.currency)}</strong></div>
          <div className={styles.list}>{group.items.map((item) => <div className={styles.summaryLine} key={item.cartItemId}><span>{item.productTitle}{item.variantName ? ` · ${item.variantName}` : ""} × {item.quantity}</span><strong>{formatMoney(item.lineTotalMinor, item.currency)}</strong></div>)}</div>
        </article>)}</div>

        {requiresDelivery && <div className={styles.form} style={{ marginTop: 18 }}>
          <div className={styles.sectionTitle}><div><small className={styles.eyebrow}>DELIVERY</small><h2>Where should it go?</h2></div></div>
          <div className={styles.split}>
            <label>Recipient name<input required value={form.deliveryName ?? ""} onChange={(event) => setField("deliveryName", event.target.value)} /></label>
            <label>Phone<input required value={form.deliveryPhone ?? ""} onChange={(event) => setField("deliveryPhone", event.target.value)} /></label>
          </div>
          <label>Address<input required value={form.deliveryAddress ?? ""} onChange={(event) => setField("deliveryAddress", event.target.value)} /></label>
          <div className={styles.split}>
            <label>City<input required value={form.deliveryCity ?? ""} onChange={(event) => setField("deliveryCity", event.target.value)} /></label>
            <label>State<input required value={form.deliveryState ?? ""} onChange={(event) => setField("deliveryState", event.target.value)} /></label>
          </div>
          <label>Country<input required value={form.deliveryCountry ?? ""} onChange={(event) => setField("deliveryCountry", event.target.value)} /></label>
          <label>Delivery note<textarea value={form.deliveryNote ?? ""} onChange={(event) => setField("deliveryNote", event.target.value)} placeholder="Landmark, access note, preferred delivery instructions…" /></label>
        </div>}
      </section>

      <aside className={`${styles.panel} ${styles.summary}`}>
        <div><small className={styles.eyebrow}>BOUNDARY</small><h2>Payment comes next.</h2></div>
        {preview.groups.map((group) => <div className={styles.summaryLine} key={group.seller.id}><span>{group.seller.displayName ?? group.seller.username}</span><strong>{formatMoney(group.subtotalMinor, group.currency)}</strong></div>)}
        <div className={styles.notice}><strong>PENDING means unpaid.</strong><p>{preview.inventoryPolicy}</p><p>Phase 13 will introduce the authoritative payment path. This checkout cannot mark an Order PAID.</p></div>
        <button className={styles.buttonAlt} type="submit" disabled={submitting}>{submitting ? "Creating Order…" : "Create PENDING Order →"}</button>
        <a className={styles.button} href="/cart">← Back to Cart</a>
      </aside>
    </form>}
  </main>;
}
