"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ExperienceHeader } from "../../components/navigation/experience-header";
import { ExperienceState } from "../../components/experience/experience-state";
import { checkout, formatMoney, getCheckoutPreview, type CheckoutInput, type CheckoutPreview } from "../../lib/commerce";
import styles from "../commerce.module.css";

export default function CheckoutPage() {
  const [preview, setPreview] = useState<CheckoutPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [previewBusy, setPreviewBusy] = useState(true);
  const [form, setForm] = useState<CheckoutInput>({ deliveryCountry: "Nigeria" });

  async function reloadPreview() {
    setPreviewBusy(true);
    setError(null);
    try {
      setPreview(await getCheckoutPreview());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load checkout preview");
    } finally {
      setPreviewBusy(false);
    }
  }
  useEffect(() => { void reloadPreview(); }, []);

  const requiresDelivery = useMemo(() => preview?.groups.some((group) => group.requiresDelivery) ?? false, [preview]);

  function setField<K extends keyof CheckoutInput>(field: K, value: CheckoutInput[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting || previewBusy || !preview || preview.groups.length === 0) return;
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

  return <main className={[styles.shell, "h-experience-shell"].join(" ")}>
    <ExperienceHeader section="Checkout"
      trail={[{ href: "/marketplace", label: "Marketplace" }, { href: "/cart", label: "Cart" }]}
      secondaryLinks={[{ href: "/orders", label: "Orders" }]} />

    <section className={[styles.hero, "h-experience-hero"].join(" ")}>
      <div><p className={styles.eyebrow}>SECURE ORDER REVIEW</p><h1 className="h-experience-heading">Confirm the transaction.</h1></div>
      <p>Checkout creates a durable PENDING Order. It does not charge you, reserve stock, or claim payment success.</p>
    </section>

    {error && preview && <div className={styles.error} role="alert">{error}</div>}
    {!preview && previewBusy && <ExperienceState kind="loading" title="Checking cart and product availability…" />}
    {!preview && !previewBusy && error && <ExperienceState kind="error" title="Could not prepare Checkout." description="Your cart remains available. Try loading the preview again." action={{label:"Retry checkout preview",onClick:()=>void reloadPreview()}} />}
    {preview && preview.groups.length === 0 && <ExperienceState kind="empty" title="Your cart is empty." description="Add a Product before starting an Order." action={{label:"Explore Products",href:"/marketplace"}} />}

    {preview && preview.groups.length > 0 && <form className={styles.grid} onSubmit={submit} aria-busy={submitting}>
      <section className={styles.panel}>
        <div className={styles.sectionTitle}><div><small className={styles.eyebrow}>ORDER PREVIEW</small><h2>{preview.groups.length} seller order{preview.groups.length === 1 ? "" : "s"}</h2></div></div>
        <div className={styles.list}>{preview.groups.map((group) => <article className={styles.card} key={`${group.seller.id}:${group.currency}`}>
          <div className={styles.cardTop}><div><small className={styles.eyebrow}>SELLER</small><h3>{group.seller.displayName ?? `@${group.seller.username}`}</h3><div className={styles.meta}><span>@{group.seller.username}</span><span>{group.requiresDelivery ? "Physical delivery" : "Digital fulfillment"}</span></div></div><strong className={styles.price}>{formatMoney(group.subtotalMinor, group.currency)}</strong></div>
          <div className={styles.list}>{group.items.map((item) => <div className={styles.summaryLine} key={item.cartItemId}><span>{item.productTitle}{item.variantName ? ` · ${item.variantName}` : ""} × {item.quantity}</span><strong>{formatMoney(item.lineTotalMinor, item.currency)}</strong></div>)}</div>
        </article>)}</div>

        {requiresDelivery && <div className={styles.form} style={{ marginTop: 18 }}>
          <div className={styles.sectionTitle}><div><small className={styles.eyebrow}>DELIVERY</small><h2>Where should it go?</h2></div></div>
          <div className={styles.split}>
            <label>Recipient name<input autoComplete="name" required value={form.deliveryName ?? ""} onChange={(event) => setField("deliveryName", event.target.value)} /></label>
            <label>Phone<input type="tel" inputMode="tel" autoComplete="tel" required value={form.deliveryPhone ?? ""} onChange={(event) => setField("deliveryPhone", event.target.value)} /></label>
          </div>
          <label>Address<input autoComplete="street-address" required value={form.deliveryAddress ?? ""} onChange={(event) => setField("deliveryAddress", event.target.value)} /></label>
          <div className={styles.split}>
            <label>City<input autoComplete="address-level2" required value={form.deliveryCity ?? ""} onChange={(event) => setField("deliveryCity", event.target.value)} /></label>
            <label>State<input autoComplete="address-level1" required value={form.deliveryState ?? ""} onChange={(event) => setField("deliveryState", event.target.value)} /></label>
          </div>
          <label>Country<input autoComplete="country-name" required value={form.deliveryCountry ?? ""} onChange={(event) => setField("deliveryCountry", event.target.value)} /></label>
          <label>Delivery note<textarea value={form.deliveryNote ?? ""} onChange={(event) => setField("deliveryNote", event.target.value)} placeholder="Landmark, access note, preferred delivery instructions…" /></label>
        </div>}
      </section>

      <aside className={`${styles.panel} ${styles.summary}`}>
        <div><small className={styles.eyebrow}>BOUNDARY</small><h2>Payment comes next.</h2></div>
        {preview.groups.map((group) => <div className={styles.summaryLine} key={group.seller.id}><span>{group.seller.displayName ?? group.seller.username}</span><strong>{formatMoney(group.subtotalMinor, group.currency)}</strong></div>)}
        <div className={styles.notice}><strong>PENDING means unpaid.</strong><p>{preview.inventoryPolicy}</p><p>After Order creation, a separate provider-confirmed payment step is required. Checkout never marks an Order PAID.</p></div>
        <button className={styles.buttonAlt} type="submit" aria-busy={submitting} disabled={submitting || previewBusy}>{submitting ? "Creating Order…" : "Create unpaid Order →"}</button>
        <a className={styles.button} href="/cart">← Back to Cart</a>
      </aside>
    </form>}
  </main>;
}
