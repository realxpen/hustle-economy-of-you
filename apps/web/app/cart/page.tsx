"use client";

import { useCallback, useEffect, useState } from "react";
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
    setBusyId(itemId);
    try {
      setError(null);
      setCart(await updateCartItem(itemId, quantity));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update quantity");
    } finally { setBusyId(null); }
  }

  async function remove(itemId: string) {
    setBusyId(itemId);
    try {
      setError(null);
      setCart(await removeCartItem(itemId));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not remove item");
    } finally { setBusyId(null); }
  }

  async function clear() {
    setClearing(true);
    try {
      setError(null);
      const result = await clearCart();
      setCart(result.cart);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not clear Cart");
    } finally { setClearing(false); }
  }

  return <main className={styles.shell}>
    <header className={styles.header}>
      <a className={styles.brand} href="/">HUSTLE↗</a>
      <nav className={styles.nav}><a href="/home">Home</a><a href="/marketplace">Marketplace</a><a href="/orders">Orders</a><a href="/account">Account</a></nav>
    </header>

    <section className={styles.hero}>
      <div><p className={styles.eyebrow}>PHASE 12 · CART</p><h1>Your buying intent.</h1></div>
      <p>Cart stays mutable until checkout. Stock and price are revalidated on the server, and nothing is treated as paid until Phase 13 confirms it.</p>
    </section>

    {error && <div className={styles.error}>{error}</div>}
    {!cart && !error && <div className={styles.loading}>Loading Cart…</div>}

    {cart && <div className={styles.grid}>
      <section className={styles.panel}>
        <div className={styles.sectionTitle}><div><small className={styles.eyebrow}>ITEMS</small><h2>{cart.itemCount} item{cart.itemCount === 1 ? "" : "s"}</h2></div>{cart.items.length > 0 && <button className={styles.danger} onClick={clear} disabled={clearing}>{clearing ? "Clearing…" : "Clear Cart"}</button>}</div>
        {cart.items.length === 0 && <div className={styles.empty}>Your Cart is empty. <a className={styles.link} href="/marketplace">Browse Marketplace →</a></div>}
        <div className={styles.list}>{cart.items.map((item) => <article key={item.id} className={styles.card}>
          <div className={styles.cardTop}>
            <div><small className={styles.eyebrow}>{item.productType}</small><h3><a href={item.productUrl}>{item.productTitle}</a></h3><div className={styles.meta}><span>{item.variantName ?? "Standard"}</span><span>Sold by @{item.seller.username ?? item.seller.displayName ?? "seller"}</span></div></div>
            <strong className={styles.price}>{formatMoney(item.lineTotalMinor, item.currency)}</strong>
          </div>
          <div className={styles.meta}><span>{formatMoney(item.unitPriceMinor, item.currency)} each</span>{item.inventoryAvailable !== null && <span>{item.inventoryAvailable} available</span>}{!item.available && <span>{item.availabilityReason}</span>}</div>
          <div className={styles.row}>
            <label>Qty <input aria-label={`Quantity for ${item.productTitle}`} type="number" min={1} max={99} value={item.quantity} disabled={busyId === item.id} onChange={(event) => { const quantity = Number(event.target.value); if (Number.isInteger(quantity) && quantity >= 1) void changeQuantity(item.id, quantity); }} /></label>
            <button className={styles.danger} onClick={() => void remove(item.id)} disabled={busyId === item.id}>{busyId === item.id ? "Updating…" : "Remove"}</button>
          </div>
        </article>)}</div>
      </section>

      <aside className={`${styles.panel} ${styles.summary}`}>
        <div className={styles.sectionTitle}><div><small className={styles.eyebrow}>SUMMARY</small><h2>Cart total</h2></div></div>
        {cart.totals.map((total) => <div className={styles.summaryLine} key={total.currency}><span>{total.currency}</span><strong>{formatMoney(total.subtotalMinor, total.currency)}</strong></div>)}
        <div className={styles.notice}><strong>Inventory is not reserved.</strong><p>A Cart and a PENDING Order do not own stock. Phase 13 will revalidate stock when payment is authoritatively confirmed.</p></div>
        {cart.items.length > 0 && <a className={styles.buttonAlt} href="/checkout">Continue to checkout →</a>}
      </aside>
    </div>}

    <footer className={styles.footer}><span>One buyer identity. No shopping mode.</span><strong>Payment remains server-authoritative.</strong></footer>
  </main>;
}
