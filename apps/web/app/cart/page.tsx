"use client";

import { useCallback, useEffect, useState } from "react";
import { ExperienceHeader } from "../../components/navigation/experience-header";
import { ExperienceState } from "../../components/experience/experience-state";
import { clearCart, formatMoney, getCart, removeCartItem, type Cart, updateCartItem } from "../../lib/commerce";
import styles from "../commerce.module.css";

export default function CartPage() {
  const [cart, setCart] = useState<Cart | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      setCart(await getCart());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load your Cart");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function changeQuantity(itemId: string, quantity: number) {
    if (busyId || clearing || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) return;
    setBusyId(itemId);
    try {
      setError(null);
      setCart(await updateCartItem(itemId, quantity));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update quantity");
    } finally { setBusyId(null); }
  }

  async function remove(itemId: string) {
    if (busyId || clearing) return;
    setBusyId(itemId);
    try {
      setError(null);
      setCart(await removeCartItem(itemId));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not remove item");
    } finally { setBusyId(null); }
  }

  async function clear() {
    if (busyId || clearing || !window.confirm("Remove every product from your Cart?")) return;
    setClearing(true);
    try {
      setError(null);
      const result = await clearCart();
      setCart(result.cart);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not clear Cart");
    } finally { setClearing(false); }
  }

  const unavailableItems = cart?.items.filter((item) => !item.available) ?? [];
  const changing = Boolean(busyId) || clearing;
  return <main className={[styles.shell, "h-experience-shell"].join(" ")}>
    <ExperienceHeader section="Cart" trail={[{href:"/marketplace",label:"Marketplace"}]}
      secondaryLinks={[{href:"/orders",label:"Orders"},{href:"/messages",label:"Messages"}]} />
    <nav className={styles.purchaseFlow} aria-label="Buying journey">
      <span>1. Choose products</span><strong aria-current="step">2. Review Cart</strong>
      <span>3. Check Order</span><span>4. Track Order</span>
    </nav>

    <section className={styles.hero}>
      <div><p className={styles.eyebrow}>YOUR CART</p><h1>Your buying intent.</h1></div>
      <p>Review your products, quantities and sellers here. Checkout checks price and stock again; creating an Order never means it has been paid.</p>
    </section>

    {error && cart && <div className={styles.error} role="alert">{error} <button type="button" onClick={()=>void load()}>Retry loading Cart</button></div>}
    {!cart && error && <ExperienceState kind="error" title="Cart unavailable." description={error} action={{label:"Retry Cart",onClick:()=>void load()}} />}
    {!cart && !error && <ExperienceState kind="loading" title="Loading Cart…" />}

    {cart && <div className={styles.grid}>
      <section className={styles.panel}>
        <div className={styles.sectionTitle}><div><small className={styles.eyebrow}>ITEMS</small><h2>{cart.itemCount} item{cart.itemCount === 1 ? "" : "s"}</h2></div>{cart.items.length > 0 && <button className={styles.danger} onClick={()=>void clear()} disabled={changing}>{clearing ? "Clearing…" : "Clear Cart"}</button>}</div>
        {cart.items.length === 0 && <div className={styles.empty}>Your Cart is empty. <a className={styles.link} href="/marketplace">Browse Marketplace →</a></div>}
        <div className={styles.list}>{cart.items.map((item) => <article key={item.id} className={styles.card}>
          <div className={styles.cardTop}>
            <div><small className={styles.eyebrow}>{item.productType}</small><h3><a href={item.productUrl}>{item.productTitle}</a></h3><div className={styles.meta}><span>{item.variantName ?? "Standard"}</span><span>Sold by @{item.seller.username ?? item.seller.displayName ?? "seller"}</span></div></div>
            <strong className={styles.price}>{formatMoney(item.lineTotalMinor, item.currency)}</strong>
          </div>
          <div className={styles.meta}><span>{formatMoney(item.unitPriceMinor, item.currency)} each</span>{item.inventoryAvailable !== null && <span>{item.inventoryAvailable} available</span>}{!item.available && <span>{item.availabilityReason}</span>}</div>
          <div className={styles.row}>
            <label>Qty <input aria-label={`Quantity for ${item.productTitle}`} type="number" min={1} max={99} value={item.quantity} disabled={changing} onChange={(event) => { const quantity = Number(event.target.value); if (Number.isInteger(quantity) && quantity >= 1 && quantity <= 99) void changeQuantity(item.id, quantity); }} /></label>
            <button className={styles.danger} onClick={() => void remove(item.id)} disabled={changing}>{busyId === item.id ? "Updating…" : "Remove"}</button>
          </div>
        </article>)}</div>
      </section>

      <aside className={`${styles.panel} ${styles.summary}`}>
        <div className={styles.sectionTitle}><div><small className={styles.eyebrow}>SUMMARY</small><h2>Cart total</h2></div></div>
        {cart.totals.map((total) => <div className={styles.summaryLine} key={total.currency}><span>{total.currency}</span><strong>{formatMoney(total.subtotalMinor, total.currency)}</strong></div>)}
        <div className={styles.notice}><strong>Inventory is not reserved.</strong><p>Items can become unavailable before purchase. Checkout validates current price and stock again, and only a payment-provider confirmation can mark an Order paid.</p></div>
        {unavailableItems.length > 0 && <div className={styles.error} role="alert">
          {unavailableItems.length} item{unavailableItems.length === 1 ? " is" : "s are"} currently unavailable.
          Remove or review {unavailableItems.length === 1 ? "it" : "them"} before checkout; the server will verify again.
        </div>}
        {cart.items.length > 0 && unavailableItems.length === 0 && <a className={styles.buttonAlt} href="/checkout"
          aria-disabled={changing} onClick={(event) => { if (changing) event.preventDefault(); }}>Review checkout →</a>}
        {cart.items.length > 0 && unavailableItems.length > 0 && <button className={styles.buttonAlt}
          type="button" disabled>Review unavailable items first</button>}
      </aside>
    </div>}

    <footer className={styles.footer}><span>One buyer identity. No shopping mode.</span><strong>Payment remains server-authoritative.</strong></footer>
  </main>;
}
