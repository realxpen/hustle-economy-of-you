"use client";

import type { MouseEvent } from "react";
import type { PublicOwner, SearchResult } from "../../lib/search";
import { formatProductPrice } from "../../lib/product";
import { formatServicePrice } from "../../lib/service";
import styles from "./search.module.css";

function Avatar({ owner, large = false }: { owner: PublicOwner; large?: boolean }) {
  const initial = (owner.displayName ?? owner.username ?? "H").charAt(0).toUpperCase();
  return <span className={large ? styles.discoveryAvatarLarge : styles.discoveryAvatar}>
    {owner.avatarUrl ? <img src={owner.avatarUrl} alt="" loading="lazy" /> : initial}
  </span>;
}

function Creator({ owner }: { owner: PublicOwner }) {
  return <span className={styles.discoveryCreator}>
    <Avatar owner={owner} />
    <span className={styles.discoveryCreatorName}>{owner.displayName ?? owner.username ?? "Hustler"}</span>
  </span>;
}

export function ResultCard({
  item,
  onOpen
}: {
  item: SearchResult;
  onOpen: (item: SearchResult) => void | Promise<unknown>;
}) {
  const href = item.url ?? "#";

  async function handleOpen(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      void Promise.resolve(onOpen(item)).catch(() => undefined);
      return;
    }
    event.preventDefault();
    try {
      await Promise.resolve(onOpen(item));
    } catch {
      // Observation must never block canonical navigation.
    }
    if (href !== "#") window.location.assign(href);
  }

  if (item.kind === "person") {
    const person = item.person;
    const summary = person.professionalProfile.headline ??
      person.professionalProfile.primarySkill ?? person.bio ?? "Explore their work on Hustle";
    return <a className={styles.discoveryPerson} href={href} onClick={handleOpen}>
      <Avatar owner={person} large />
      <span className={styles.discoveryPersonText}>
        <strong>{person.displayName ?? person.username ?? "Hustler"}</strong>
        <span className={styles.discoveryHandle}>@{person.username ?? "hustler"}{person.verified ? " · Contact verified" : ""}</span>
        <span className={styles.discoverySummary}>{summary}</span>
        {person.location && <span className={styles.discoveryLocation}>{person.location}</span>}
      </span>
      <span className={styles.discoveryAction} aria-hidden="true">↗</span>
    </a>;
  }

  if (item.kind === "post") {
    const first = item.post.media[0];
    const isVideo = first?.type === "VIDEO";
    return <a className={styles.discoveryPost} href={href} onClick={handleOpen}>
      <span className={styles.discoveryPostVisual}>
        {first?.type === "IMAGE" && first.mediaUrl
          ? <img src={first.mediaUrl} alt="" loading="lazy" />
          : isVideo && first.mediaUrl
            ? <video src={first.mediaUrl} muted playsInline preload="metadata" aria-hidden="true" tabIndex={-1} />
            : <span className={styles.discoveryMediaEmpty} aria-hidden="true">✦</span>}
        <span className={styles.discoveryMediaTag}>{isVideo ? "Video" : first?.type === "IMAGE" ? "Photo" : "Post"}</span>
        {isVideo && <span className={styles.discoveryPlay} aria-hidden="true">▶</span>}
      </span>
      <span className={styles.discoveryPostDetails}>
        <span className={styles.discoveryPostCaption}>{item.post.caption ?? item.post.category ?? "Explore this work"}</span>
        <Creator owner={item.owner} />
        <span className={styles.discoveryPostFoot}>
          <span>{item.post.category ?? "Work on Hustle"}</span>
          {item.engagement.likes > 0 && <span>♡ {item.engagement.likes}</span>}
        </span>
      </span>
    </a>;
  }

  if (item.kind === "service") {
    return <a className={styles.discoveryService} href={href} onClick={handleOpen}>
      <span className={styles.discoveryOfferVisual}>
        {item.service.mediaUrls?.[0]
          ? <img src={item.service.mediaUrls[0]} alt="" loading="lazy" />
          : <span className={styles.discoveryMediaEmpty} aria-hidden="true">✦</span>}
        <span className={styles.discoveryMediaTag}>Service</span>
      </span>
      <div className={styles.discoveryOfferInfo}>
        <h3 className={styles.discoveryOfferTitle}>{item.service.title ?? "Service"}</h3>
        <strong className={styles.discoveryOfferPrice}>{formatServicePrice(item.service)}</strong>
        <span className={styles.discoveryOfferDescription}>
          {item.service.description ?? item.service.category ?? "Explore this service"}
        </span>
        <Creator owner={item.owner} />
        <span className={styles.discoveryOfferAction}>View service <span aria-hidden="true">↗</span></span>
      </div>
    </a>;
  }

  return <a className={styles.discoveryProduct} href={href} onClick={handleOpen}>
    <span className={styles.discoveryProductVisual}>
      {item.product.mediaUrls?.[0]
        ? <img src={item.product.mediaUrls[0]} alt="" loading="lazy" />
        : <span className={styles.discoveryMediaEmpty} aria-hidden="true">◈</span>}
      <span className={styles.discoveryMediaTag}>Product</span>
    </span>
    <div className={styles.discoveryProductInfo}>
      <h3 className={styles.discoveryOfferTitle}>{item.product.title ?? "Product"}</h3>
      <strong className={styles.discoveryOfferPrice}>{formatProductPrice(item.product)}</strong>
      <Creator owner={item.owner} />
    </div>
  </a>;
}
