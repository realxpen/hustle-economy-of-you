"use client";

import { useMemo, useState } from "react";
import type { PublicProduct } from "../../../lib/product";
import { addCartItem } from "../../../lib/commerce";
import styles from "./page.module.css";

export function AddToCart({ data }: { data: PublicProduct }) {
  const { product } = data;
  const activeVariants = useMemo(() => product.variants.filter((variant) => variant.isActive), [product.variants]);
  const [variantId, setVariantId] = useState(activeVariants.length === 1 ? activeVariants[0].id : "");
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    if (activeVariants.length > 0 && !variantId) {
      setError("Choose a Product variant first.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const cart = await addCartItem({
        productId: product.id,
        ...(variantId ? { productVariantId: variantId } : {}),
        quantity
      });
      setMessage(`Added to Cart · ${cart.itemCount} item${cart.itemCount === 1 ? "" : "s"}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not add this Product to Cart");
    } finally { setBusy(false); }
  }

  return <div className={styles.cartBox}>
    <div className={styles.cartHeading}><small>BUY ON HUSTLE</small><strong>Add to Cart</strong></div>
    {activeVariants.length > 0 && <label className={styles.cartField}>Variant<select value={variantId} onChange={(event) => setVariantId(event.target.value)}><option value="">Choose a variant</option>{activeVariants.map((variant) => <option key={variant.id} value={variant.id}>{variant.name}</option>)}</select></label>}
    <label className={styles.cartField}>Quantity<input type="number" min={1} max={99} value={quantity} onChange={(event) => { const value = Number(event.target.value); if (Number.isInteger(value) && value >= 1) setQuantity(value); }} /></label>
    <button className={styles.cartButton} disabled={busy || !product.inStock} onClick={() => void add()}>{busy ? "Adding…" : product.inStock ? "Add to Cart →" : "Out of stock"}</button>
    {message && <div className={styles.cartSuccess}>{message} · <a href="/cart">Open Cart →</a></div>}
    {error && <div className={styles.cartError}>{error}</div>}
    <p className={styles.cartPolicy}>Adding to Cart does not reserve inventory or charge you. Checkout creates a PENDING Order; Phase 13 will own payment.</p>
  </div>;
}
