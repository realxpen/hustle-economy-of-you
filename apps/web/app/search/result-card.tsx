"use client";

import type { PublicOwner, SearchResult } from "../../lib/search";
import { formatProductPrice } from "../../lib/product";
import { formatServicePrice } from "../../lib/service";
import styles from "./search.module.css";

function Owner({ owner }: { owner: PublicOwner }) {
  const initial = (owner.displayName ?? owner.username ?? "H").charAt(0).toUpperCase();
  return <div className={styles.owner}>
    <div className={styles.avatar}>{owner.avatarUrl ? <img src={owner.avatarUrl} alt="" /> : initial}</div>
    <div className={styles.ownerText}>
      <strong>{owner.displayName ?? owner.username ?? "Hustler"}</strong>
      <span>@{owner.username ?? "hustler"}{owner.verified ? " · Verified" : ""}</span>
    </div>
  </div>;
}

export function ResultCard({
  item,
  onOpen
}: {
  item: SearchResult;
  onOpen: (item: SearchResult) => void;
}) {
  const href = item.url ?? "#";

  if (item.kind === "person") {
    const profile = item.person.professionalProfile;
    return <a className={styles.card} href={href} onClick={() => onOpen(item)}>
      <div className={styles.media}><div className={styles.mediaFallback}>{(item.person.displayName ?? item.person.username ?? "H").charAt(0)}</div></div>
      <div className={styles.cardBody}>
        <span className={styles.kind}>PERSON · {Math.round(item.ranking.score)} RELEVANCE</span>
        <h3>{item.person.displayName ?? item.person.username ?? "Hustler"}</h3>
        <p>{profile.headline ?? profile.primarySkill ?? item.person.bio ?? "Professional identity on Hustle."}</p>
        <Owner owner={item.person} />
        <div className={styles.rank}>{item.ranking.reasons.slice(0, 4).map((reason) => <span key={reason}>{reason}</span>)}</div>
      </div>
    </a>;
  }

  if (item.kind === "post") {
    const first = item.post.media[0];
    return <a className={styles.card} href={href} onClick={() => onOpen(item)}>
      <div className={styles.media}>
        {first?.type === "IMAGE" && first.mediaUrl
          ? <img src={first.mediaUrl} alt="Demonstrated capability" loading="lazy" />
          : <div className={styles.mediaFallback}>{first?.type === "VIDEO" ? "▶" : "↗"}</div>}
      </div>
      <div className={styles.cardBody}>
        <span className={styles.kind}>POST · {Math.round(item.ranking.score)} RELEVANCE</span>
        <h3>{item.post.category ?? item.owner.professionalProfile.primarySkill ?? "Capability proof"}</h3>
        <p>{item.post.caption ?? "Published capability proof."}</p>
        <Owner owner={item.owner} />
        <div className={styles.rank}>{item.ranking.reasons.slice(0, 4).map((reason) => <span key={reason}>{reason}</span>)}</div>
      </div>
    </a>;
  }

  if (item.kind === "service") {
    return <a className={styles.card} href={href} onClick={() => onOpen(item)}>
      <div className={styles.media}>
        {item.service.mediaUrls?.[0]
          ? <img src={item.service.mediaUrls[0]} alt="" loading="lazy" />
          : <div className={styles.mediaFallback}>S</div>}
      </div>
      <div className={styles.cardBody}>
        <span className={styles.kind}>SERVICE · {Math.round(item.ranking.score)} RELEVANCE</span>
        <h3>{item.service.title ?? "Service"}</h3>
        <div className={styles.price}>{formatServicePrice(item.service)}</div>
        <p>{item.service.description ?? item.service.category ?? "Published Hustle service."}</p>
        <Owner owner={item.owner} />
        <div className={styles.rank}>{item.ranking.reasons.slice(0, 4).map((reason) => <span key={reason}>{reason}</span>)}</div>
      </div>
    </a>;
  }

  return <a className={styles.card} href={href} onClick={() => onOpen(item)}>
    <div className={styles.media}>
      {item.product.mediaUrls?.[0]
        ? <img src={item.product.mediaUrls[0]} alt="" loading="lazy" />
        : <div className={styles.mediaFallback}>P</div>}
    </div>
    <div className={styles.cardBody}>
      <span className={styles.kind}>PRODUCT · {Math.round(item.ranking.score)} RELEVANCE</span>
      <h3>{item.product.title ?? "Product"}</h3>
      <div className={styles.price}>{formatProductPrice(item.product)}</div>
      <p>{item.product.description ?? item.product.category ?? "Published Hustle product."}</p>
      <Owner owner={item.owner} />
      <div className={styles.rank}>{item.ranking.reasons.slice(0, 4).map((reason) => <span key={reason}>{reason}</span>)}</div>
    </div>
  </a>;
}
