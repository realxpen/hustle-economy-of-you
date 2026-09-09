"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { formatProductPrice } from "../../../lib/product";
import { formatServicePrice } from "../../../lib/service";
import { getPublicPost, type PublicPost } from "../../../lib/post";
import styles from "./page.module.css";

export default function PublicPostPage() {
  const params = useParams<{ postId: string }>();
  const [data, setData] = useState<PublicPost | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPublicPost(params.postId).then(setData).catch((reason: Error) => setError(reason.message));
  }, [params.postId]);

  if (error) return <main className={styles.shell}><section className={styles.notFound}><p>CONTENT UNAVAILABLE</p><h1>This post is not public.</h1><span>{error}</span><a href="/">Back to Hustle →</a></section></main>;
  if (!data) return <main className={styles.shell}><p className={styles.loading}>Loading post…</p></main>;

  const { post, owner } = data;
  const initial = (owner.displayName ?? owner.username ?? "H").charAt(0).toUpperCase();

  return <main className={styles.shell}>
    <header className={styles.header}><a className={styles.brand} href="/">HUSTLE↗</a><span>DEMONSTRATED CAPABILITY</span></header>

    <section className={styles.layout}>
      <div className={styles.content}>
        <div className={styles.mediaGrid}>
          {post.media.map((item) => item.type === "VIDEO"
            ? <video className={styles.media} key={item.id} src={item.mediaUrl ?? undefined} controls playsInline />
            : <img className={styles.media} key={item.id} src={item.mediaUrl ?? ""} alt="Post media" />)}
        </div>
        <div className={styles.body}>
          <div className={styles.meta}><span>{post.category}</span>{post.location && <span>{post.location}</span>}</div>
          <p className={styles.caption}>{post.caption}</p>
          {post.tags.length > 0 && <div className={styles.tags}>{post.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>}
        </div>
      </div>

      <aside className={styles.ownerCard}>
        <small>CREATOR</small>
        <div className={styles.ownerTop}>
          <div className={styles.avatar}>{owner.avatarUrl ? <img src={owner.avatarUrl} alt="" /> : initial}</div>
          <div><h2>{owner.displayName ?? owner.username ?? "Hustler"}</h2><span>@{owner.username ?? "hustler"}{owner.verified ? " · Verified" : ""}</span></div>
        </div>
        <p>{owner.professionalProfile.headline ?? owner.professionalProfile.professionalSummary ?? owner.bio}</p>
        <div className={styles.skills}>{[owner.professionalProfile.primarySkill, ...owner.professionalProfile.secondarySkills].filter(Boolean).map((skill) => <span key={skill ?? "skill"}>{skill}</span>)}</div>
        {owner.username && <a className={styles.profileLink} href={`/u/${owner.username}`}>View professional identity →</a>}
      </aside>
    </section>

    {(post.serviceAttachments.length > 0 || post.productAttachments.length > 0) && <section className={styles.offers}>
      <div className={styles.sectionHeading}><small>ATTACHED OPPORTUNITIES</small><h2>Move from proof to action.</h2></div>
      <div className={styles.offerGrid}>
        {post.serviceAttachments.map(({ service }) => <a className={styles.offerCard} key={service.id} href={`/services/${service.id}`}>
          <span>SERVICE</span><h3>{service.title ?? "Service"}</h3><p>{service.description?.slice(0, 150)}</p><strong>{formatServicePrice(service)}</strong><b>View service →</b>
        </a>)}
        {post.productAttachments.map(({ product }) => <a className={styles.offerCard} key={product.id} href={`/products/${product.id}`}>
          <span>PRODUCT</span><h3>{product.title ?? "Product"}</h3><p>{product.description?.slice(0, 150)}</p><strong>{formatProductPrice(product)}</strong><b>View product →</b>
        </a>)}
      </div>
    </section>}
  </main>;
}
