"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { formatProductPrice, getPublicProduct, type PublicProduct } from "../../../lib/product";
import { AddToCart } from "./add-to-cart";
import styles from "./page.module.css";

export default function PublicProductPage() {
  const params = useParams<{ productId: string }>();
  const [data, setData] = useState<PublicProduct | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params?.productId) return;
    getPublicProduct(params.productId)
      .then(setData)
      .catch((reason: Error) => setError(reason.message));
  }, [params?.productId]);

  if (error) return <main className={styles.shell}><section className={styles.notFound}><p>HUSTLE · PRODUCT</p><h1>Product unavailable.</h1><span>{error}</span><a href="/">← Hustle</a></section></main>;
  if (!data) return <main className={styles.shell}><p className={styles.loading}>Loading product…</p></main>;

  const { product, owner } = data;
  const initial = (owner.displayName ?? owner.username ?? "H").charAt(0).toUpperCase();
  const heroMedia = product.mediaUrls[0];

  return <main className={styles.shell}>
    <header className={styles.header}><a href="/" className={styles.brand}>HUSTLE↗</a><nav className={styles.headerNav}><a href="/marketplace">Marketplace</a><a href="/cart">Cart</a><a href="/orders">Orders</a></nav></header>

    <section className={styles.topGrid}>
      <div className={styles.media} style={heroMedia ? { backgroundImage: `url(${heroMedia})` } : undefined}>{!heroMedia && <span>PRODUCT MEDIA</span>}</div>
      <div className={styles.summary}>
        <div className={styles.badges}><span>{product.type}</span><span>{product.inStock ? "AVAILABLE" : "OUT OF STOCK"}</span></div>
        <p className={styles.kicker}>{product.category}</p>
        <h1>{product.title}</h1>
        <strong className={styles.price}>{formatProductPrice(product)}</strong>
        <p className={styles.description}>{product.description}</p>
        <AddToCart data={data} />
        <div className={styles.boundary}><strong>{product.inStock ? "Commerce enabled" : "Currently unavailable"}</strong><span>Cart and checkout revalidate price, variant and inventory before a PENDING Order can be created.</span></div>
      </div>
    </section>

    {product.mediaUrls.length > 1 && <section className={styles.mediaStrip}>{product.mediaUrls.slice(1).map((url, index) => <a key={`${url}-${index}`} href={url} target="_blank" rel="noreferrer">Media {index + 2} ↗</a>)}</section>}

    <section className={styles.detailGrid}>
      <article className={styles.details}>
        <div><small>TYPE</small><strong>{product.type}</strong></div>
        <div><small>INVENTORY</small><strong>{product.trackInventory ? product.inStock ? `${product.inventoryQuantity ?? "Variant"} available` : "Out of stock" : "Available"}</strong></div>
        <div className={styles.wide}><small>DELIVERY / ACCESS</small><p>{product.deliveryInformation || "Seller will provide delivery or access details."}</p></div>
      </article>

      <aside className={styles.ownerCard}>
        <div className={styles.ownerTop}><div className={styles.avatar}>{owner.avatarUrl ? <img src={owner.avatarUrl} alt="" /> : initial}</div><div><small>SELLER IDENTITY</small><h2>{owner.displayName ?? `@${owner.username}`}</h2><span>@{owner.username} · {owner.location ?? "Location not set"}</span></div></div>
        <p>{owner.professionalProfile.headline}</p>
        <div className={styles.skills}>{[owner.professionalProfile.primarySkill, ...owner.professionalProfile.secondarySkills].filter(Boolean).slice(0,6).map((skill) => <span key={skill as string}>{skill}</span>)}</div>
        <a className={styles.profileLink} href={`/messages/start?userId=${encodeURIComponent(owner.id)}&contextType=PRODUCT&contextId=${encodeURIComponent(product.id)}`}>Message about this product →</a>
        {owner.username && <a className={styles.profileLink} href={`/u/${owner.username}`}>View professional profile →</a>}
      </aside>
    </section>

    {product.variants.length > 0 && <section className={styles.variants}>
      <div className={styles.sectionHeading}><small>VARIANTS</small><h2>Available choices</h2></div>
      <div className={styles.variantGrid}>{product.variants.map((variant) => <article key={variant.id}><span>{variant.name}</span><strong>{formatProductPrice(product, variant)}</strong><p>{Object.entries(variant.optionValues ?? {}).map(([key,value]) => `${key}: ${value}`).join(" · ") || "Standard option"}</p>{product.trackInventory && <small>{(variant.inventoryQuantity ?? 0) > 0 ? `${variant.inventoryQuantity} in stock` : "Stock follows product availability"}</small>}</article>)}</div>
    </section>}
  </main>;
}
