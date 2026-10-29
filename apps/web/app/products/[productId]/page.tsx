"use client";

import { ExperienceHeader } from "../../../components/navigation/experience-header";
import { ExperienceState } from "../../../components/experience/experience-state";
import { useEffect, useState } from "react";
import { OpportunityContext } from "../../../components/commerce/opportunity-context";
import { useSourcePost } from "../../../lib/opportunity-source";
import { useParams } from "next/navigation";
import { formatProductPrice, getPublicProduct, type PublicProduct } from "../../../lib/product";
import { AddToCart } from "./add-to-cart";
import styles from "./page.module.css";

function isProductVideo(url: string) {
  return /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url);
}

export default function PublicProductPage() {
  const params = useParams<{ productId: string }>();
  const [data, setData] = useState<PublicProduct | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryVersion, setRetryVersion] = useState(0);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const sourcePostId = useSourcePost();

  useEffect(() => {
    const productId = params?.productId;
    if (!productId) return;
    let active = true;
    setData(null);
    setError(null);
    setActiveMediaIndex(0);
    void getPublicProduct(productId)
      .then((next) => { if (active) setData(next); })
      .catch((reason: Error) => { if (active) setError(reason.message); });
    return () => { active = false; };
  }, [params?.productId, retryVersion]);

  const currentData = data?.product.id === params?.productId ? data : null;
  if (error && !currentData) return <main className={styles.shell}><ExperienceState kind="error" title="Product unavailable." description={error} action={{ label: "Try loading again", onClick: () => setRetryVersion((n) => n + 1) }} /></main>;
  if (!currentData) return <main className={styles.shell}><ExperienceState kind="loading" title="Loading Product details…" /></main>;

  const { product, owner } = currentData;
  const initial = (owner.displayName ?? owner.username ?? "H").charAt(0).toUpperCase();
  const heroMedia = product.mediaUrls[Math.min(activeMediaIndex, Math.max(0, product.mediaUrls.length - 1))];
  const sellerName = owner.displayName ?? owner.username ?? "Hustle seller";

  return <main className={styles.shell} data-hustle-product-detail="true">
    <ExperienceHeader section="Product" trail={[{ href: "/marketplace", label: "Marketplace" }]} secondaryLinks={[{ href: "/cart", label: "Cart" }, { href: "/orders", label: "Orders" }]} />
    <OpportunityContext sourcePostId={sourcePostId} ownerUsername={owner.username} />

    <div className={styles.mobileBreadcrumb}>
      <a href="/marketplace?view=products">‹ Products</a>
      <a href="/cart" aria-label="Open your Cart">Cart ↗</a>
    </div>
    <section className={styles.topGrid}>
      <div className={styles.productGallery} aria-label="Product photos and videos">
        <div className={styles.media}>
          {heroMedia
            ? isProductVideo(heroMedia)
              ? <video key={heroMedia} className={styles.heroImage} src={heroMedia} controls playsInline preload="metadata" aria-label={product.title ? `Video of ${product.title}` : "Product video"} />
              : <img key={heroMedia} className={styles.heroImage} src={heroMedia} alt={product.title ? `Photo of ${product.title}` : "Product photo"} />
            : <div className={styles.emptyProductMedia}><span aria-hidden="true">◈</span><strong>No product photo yet</strong></div>}
          {product.mediaUrls.length > 1 && <span className={styles.galleryIndex}>{activeMediaIndex + 1} / {product.mediaUrls.length}</span>}
        </div>
        {product.mediaUrls.length > 1 && <div className={styles.galleryThumbnails} role="group" aria-label="Choose product photo or video">
          {product.mediaUrls.map((url, index) => <button key={url+"-"+index} type="button"
            aria-pressed={activeMediaIndex === index} aria-label={`View product media ${index + 1}`}
            className={activeMediaIndex === index ? styles.selectedMedia : ""}
            onClick={() => setActiveMediaIndex(index)}>
            {isProductVideo(url) ? <span className={styles.videoMediaThumb}>▶ Video</span> :
              <img src={url} alt="" loading="lazy" />}
          </button>)}
        </div>}
      </div>
      <div className={styles.summary}>
        <div className={styles.badges}><span>{product.type}</span><span>{product.inStock ? "AVAILABLE" : "OUT OF STOCK"}</span></div>
        <p className={styles.kicker}>{product.category}</p>
        <h1 className="h-experience-heading">{product.title}</h1>
        <strong className={styles.price}>{formatProductPrice(product)}</strong>
        <div className={styles.sellerSummary}>
          <span className={styles.miniAvatar}>{owner.avatarUrl ? <img src={owner.avatarUrl} alt="" /> : initial}</span>
          <span><strong>{sellerName}</strong><small>{owner.location ?? "Hustle seller"}</small></span>
          {owner.username && <a href={`/u/${owner.username}`}>View seller ↗</a>}
        </div>
        <p className={styles.description}>{product.description}</p>
        <AddToCart key={product.id} data={currentData} />
        <div className={styles.boundary}><strong>{product.inStock ? "Commerce enabled" : "Currently unavailable"}</strong><span>Cart and checkout revalidate price, variant and inventory before a PENDING Order can be created.</span></div>
      </div>
    </section>

    <nav className={styles.detailTabs} aria-label="Product information">
      <a href="#product-information">Product details</a>
      <a href="#product-seller">Seller</a>
      {product.variants.length > 0 && <a href="#product-options">Options</a>}
    </nav>
    <section className={styles.detailGrid}>
      <article className={[styles.details, "h-experience-surface"].join(" ")} id="product-information">
        <div><small>TYPE</small><strong>{product.type}</strong></div>
        <div><small>INVENTORY</small><strong>{product.trackInventory ? product.inStock ? `${product.inventoryQuantity ?? "Variant"} available` : "Out of stock" : "Available"}</strong></div>
        <div className={styles.wide}><small>DELIVERY / ACCESS</small><p>{product.deliveryInformation || "Seller will provide delivery or access details."}</p></div>
      </article>

      <aside className={styles.ownerCard} id="product-seller">
        <div className={styles.ownerTop}><div className={styles.avatar}>{owner.avatarUrl ? <img src={owner.avatarUrl} alt="" /> : initial}</div><div><small>SELLER IDENTITY</small><h2>{owner.displayName ?? `@${owner.username}`}</h2><span>@{owner.username} · {owner.location ?? "Location not set"}</span></div></div>
        <p>{owner.professionalProfile.headline}</p>
        <div className={styles.skills}>{[owner.professionalProfile.primarySkill, ...owner.professionalProfile.secondarySkills].filter(Boolean).slice(0,6).map((skill) => <span key={skill as string}>{skill}</span>)}</div>
        <a className={styles.profileLink} href={`/messages/start?userId=${encodeURIComponent(owner.id)}&contextType=PRODUCT&contextId=${encodeURIComponent(product.id)}`}>Message about this product →</a>
        {owner.username && <a className={styles.profileLink} href={`/u/${owner.username}`}>View professional profile →</a>}
      </aside>
    </section>

    {product.variants.length > 0 && <section className={styles.variants} id="product-options">
      <div className={styles.sectionHeading}><small>VARIANTS</small><h2>Available choices</h2></div>
      <div className={styles.variantGrid}>{product.variants.map((variant) => <article key={variant.id}><span>{variant.name}</span><strong>{formatProductPrice(product, variant)}</strong><p>{Object.entries(variant.optionValues ?? {}).map(([key,value]) => `${key}: ${value}`).join(" · ") || "Standard option"}</p>{product.trackInventory && <small>{(variant.inventoryQuantity ?? 0) > 0 ? `${variant.inventoryQuantity} in stock` : "Stock follows product availability"}</small>}</article>)}</div>
    </section>}
    <div className={styles.stickyPurchase} aria-label="Product purchase action">
      <div><small>{product.inStock ? "Price" : "Currently unavailable"}</small><strong>{formatProductPrice(product)}</strong></div>
      {product.inStock ? <a href="#add-to-cart">Choose options <span aria-hidden="true">↗</span></a> :
        <span className={styles.unavailableSticky}>Out of stock</span>}
    </div>
  </main>;
}
