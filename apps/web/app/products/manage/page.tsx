"use client";

import { useEffect, useState } from "react";
import type { Product } from "@hustle/types";
import { formatProductPrice, getMyProducts } from "../../../lib/product";
import styles from "./page.module.css";

export default function ProductManagerPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMyProducts()
      .then(setProducts)
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, []);

  return <main className={styles.shell}>
    <header className={styles.header}>
      <a href="/account">← Your identity</a>
      <span>PHASE 6 · PRODUCTS</span>
    </header>

    <section className={styles.hero}>
      <div><p>YOUR PRODUCT ECONOMY</p><h1>Things you can <em>sell.</em></h1><span>Physical and digital products stay attached to your same professional identity.</span></div>
      <a className={styles.create} href="/products/new">Create product ↗</a>
    </section>

    {loading && <p className={styles.message}>Loading products…</p>}
    {error && <p className={styles.error}>{error}</p>}

    {!loading && !error && products.length === 0 && <section className={styles.empty}><small>NO PRODUCTS YET</small><h2>Turn something you make into a structured offer.</h2><p>Create a draft, add stock and variants if needed, then publish when it is ready.</p><a href="/products/new">Create your first product →</a></section>}

    <section className={styles.grid}>
      {products.map((product) => {
        const inStock = !product.trackInventory || (product.variants.some((variant) => (variant.inventoryQuantity ?? 0) > 0) || (product.inventoryQuantity ?? 0) > 0);
        return <article key={product.id} className={styles.card}>
          <div className={styles.media} style={product.mediaUrls[0] ? { backgroundImage: `url(${product.mediaUrls[0]})` } : undefined}><span>{product.type}</span></div>
          <div className={styles.cardBody}>
            <div className={styles.meta}><span>{product.status}</span><span>{inStock ? "AVAILABLE" : "OUT OF STOCK"}</span></div>
            <h2>{product.title ?? "Untitled product"}</h2>
            <p>{product.category ?? "Category not set"}</p>
            <strong>{formatProductPrice(product)}</strong>
            <div className={styles.actions}><a href={`/products/${product.id}/edit`}>Edit →</a>{product.status === "PUBLISHED" && <a href={`/products/${product.id}`} target="_blank" rel="noreferrer">Public ↗</a>}</div>
          </div>
        </article>;
      })}
    </section>
  </main>;
}
