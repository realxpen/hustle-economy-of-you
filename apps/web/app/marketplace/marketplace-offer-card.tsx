"use client";

import type { MouseEvent } from "react";
import type { SearchResult } from "../../lib/search";
import { formatProductPrice } from "../../lib/product";
import { formatServicePrice } from "../../lib/service";
import styles from "./marketplace.module.css";

export type Offer = Extract<SearchResult, { kind: "service" | "product" }>;

function mediaIsVideo(value: string) {
  return /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(value);
}

export function MarketplaceOfferCard({
  item,
  onOpen
}: {
  item: Offer;
  onOpen: (item: Offer) => void;
}) {
  const service = item.kind === "service";
  const title = service ? item.service.title : item.product.title;
  const category = service ? item.service.category : item.product.category;
  const photo = service ? item.service.mediaUrls?.[0] : item.product.mediaUrls?.[0];
  const price = service ? formatServicePrice(item.service) : formatProductPrice(item.product);
  const seller = item.owner.displayName ?? item.owner.username ?? "Hustle creator";
  const sellerInitial = seller.charAt(0).toUpperCase();
  const destination = item.url ?? (service ? `/services/${encodeURIComponent(item.id)}` : `/products/${encodeURIComponent(item.id)}`);

  function recordOpen(event: MouseEvent<HTMLAnchorElement>) {
    // Keep normal links working even if optional analytics is offline.
    if (event.button === 0 || event.metaKey || event.ctrlKey || event.shiftKey) onOpen(item);
  }

  return <a
    className={[styles.offerCard, service ? styles.serviceCard : styles.productCard].join(" ")}
    href={destination}
    onClick={recordOpen}
    aria-label={`${service ? "View service" : "View product"}: ${title || "Untitled offer"}, ${price}`}
  >
    <span className={styles.offerMedia}>
      {photo ? mediaIsVideo(photo)
        ? <video src={photo} muted playsInline preload="metadata" aria-hidden="true" tabIndex={-1} />
        : <img src={photo} alt="" loading="lazy" />
        : <span className={styles.emptyMedia} aria-hidden="true">{service ? "✦" : "◈"}</span>}
      <span className={styles.offerKind}>{service ? "Service" : "Product"}</span>
      {photo && mediaIsVideo(photo) && <span className={styles.mediaPlay} aria-hidden="true">▶</span>}
    </span>
    <span className={styles.offerContent}>
      {category && <span className={styles.offerCategory}>{category}</span>}
      <strong className={styles.offerName}>{title || (service ? "Service" : "Product")}</strong>
      <strong className={styles.offerPrice}>{price}</strong>
      {service && item.service.description && <span className={styles.offerDescription}>{item.service.description}</span>}
      <span className={styles.seller}>
        <span className={styles.sellerAvatar}>
          {item.owner.avatarUrl
            ? <img src={item.owner.avatarUrl} alt="" loading="lazy" />
            : sellerInitial}
        </span>
        <span className={styles.sellerName}>{seller}</span>
        {item.owner.verified && <span className={styles.verified} title="Contact verified" aria-label="Contact verified">✓</span>}
      </span>
      <span className={styles.offerAction}>
        {service ? "Explore service" : "View product"}
        <span aria-hidden="true">↗</span>
      </span>
    </span>
  </a>;
}
