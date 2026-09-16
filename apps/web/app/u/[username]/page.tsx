"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { ProfileContactActions } from "../../../components/trust/profile-contact-actions";
import { PublicReputationPanel } from "../../../components/trust/public-reputation-panel";
import {
  formatStorefrontMoney,
  formatStorefrontServicePrice,
  getPublicStorefront,
  type PublicStorefront,
  type StorefrontPost
} from "../../../lib/storefront";
import styles from "./page.module.css";

function firstPostMedia(post: StorefrontPost) {
  return post.media.find((item) => Boolean(item.mediaUrl)) ?? null;
}

export default function PublicProfilePage() {
  const params = useParams<{ username: string }>();
  const [data, setData] = useState<PublicStorefront | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shareNotice, setShareNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const username = params?.username;
    if (!username) return;

    setData(null);
    setError(null);
    getPublicStorefront(username)
      .then((storefront) => {
        if (active) setData(storefront);
      })
      .catch((reason: Error) => {
        if (active) setError(reason.message);
      });

    return () => {
      active = false;
    };
  }, [params?.username]);

  async function copyStorefront() {
    const url = window.location.href;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const field = document.createElement("textarea");
        field.value = url;
        field.style.position = "fixed";
        field.style.opacity = "0";
        document.body.appendChild(field);
        field.select();
        document.execCommand("copy");
        field.remove();
      }
      setShareNotice("Storefront link copied");
      window.setTimeout(() => setShareNotice(null), 2200);
    } catch {
      setShareNotice("Could not copy link");
    }
  }

  async function shareStorefront() {
    if (!data) return;
    const title = `${data.user.displayName ?? `@${data.user.username}`} on Hustle`;
    const text = data.profile.headline ?? "View this Hustle storefront";
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url: window.location.href });
        return;
      } catch {
        return;
      }
    }
    await copyStorefront();
  }

  if (error) {
    return <main className={styles.shell}><section className={styles.notFound}><p>HUSTLE · STOREFRONT</p><h1>Storefront unavailable.</h1><span>{error}</span><a href="/">← Hustle</a></section></main>;
  }

  if (!data) {
    return <main className={styles.shell}><p className={styles.loading}>Loading Hustle storefront…</p></main>;
  }

  const { user, profile, trust } = data;
  const initial = (user.displayName ?? user.username ?? "H").charAt(0).toUpperCase();
  const skills = [profile.primarySkill, ...profile.secondarySkills].filter(Boolean) as string[];
  const targetLabel = user.displayName ?? user.username ?? "this Hustler";
  const messageHref = `/messages/start?userId=${encodeURIComponent(user.id)}`;

  return <main className={styles.shell}>
    <header className={styles.header}>
      <a href="/" className={styles.brand}>HUSTLE↗</a>
      <nav className={styles.headerNav} aria-label="Storefront sections">
        <a href="#services">Services</a>
        <a href="#work">Work</a>
        <a href="#shop">Shop</a>
        <a href="#reviews">Reviews</a>
      </nav>
      <div className={styles.shareActions}>
        <button type="button" onClick={() => void copyStorefront()}>Copy link</button>
        <button type="button" className={styles.sharePrimary} onClick={() => void shareStorefront()}>Share</button>
      </div>
    </header>
    {shareNotice && <div className={styles.shareNotice}>{shareNotice}</div>}

    <section className={styles.cover} style={profile.coverUrl ? { backgroundImage: `url(${profile.coverUrl})` } : undefined}>
      <div className={styles.coverMark}>THE ECONOMY OF YOU</div>
    </section>

    <section className={styles.identity}>
      <div className={styles.avatar}>{user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : initial}</div>
      <div className={styles.nameRow}>
        <div>
          <p className={styles.kicker}>PUBLIC HUSTLE STOREFRONT</p>
          <h1>{user.displayName ?? `@${user.username}`}</h1>
          <span>@{user.username} · {user.location ?? "Location not set"}</span>
          {trust.reputation.reviewCount > 0 && <div className={styles.ratingLine}>
            <strong>★ {trust.reputation.averageRating?.toFixed(1)}</strong>
            <span>{trust.reputation.verifiedReviewCount} verified review{trust.reputation.verifiedReviewCount === 1 ? "" : "s"}</span>
          </div>}
        </div>
        <div className={styles.actions}>
          <div className={styles.badges}>
            <span>HUSTLER</span>
            {user.verified && <span>IDENTITY VERIFIED</span>}
            {trust.trust.hasVerifiedReviews && <span>VERIFIED REVIEWS</span>}
          </div>
          <ProfileContactActions
            targetUserId={user.id}
            targetLabel={targetLabel}
            messageHref={messageHref}
          />
        </div>
      </div>
    </section>

    <section className={styles.storefrontStats} aria-label="Storefront activity">
      <div><strong>{data.counts.services}</strong><span>Services</span></div>
      <div><strong>{data.counts.products}</strong><span>Products</span></div>
      <div><strong>{data.counts.posts}</strong><span>Published work</span></div>
      <div><strong>{data.counts.verifiedReviews}</strong><span>Verified reviews</span></div>
      <div><strong>{data.socialProof.followerCount}</strong><span>Followers</span></div>
    </section>

    <section className={styles.contentGrid} id="about">
      <article className={styles.mainStory}>
        <p className={styles.sectionEyebrow}>WHAT I DO</p>
        <h2>{profile.headline}</h2>
        <div className={styles.skills}>{skills.map((skill) => <span key={skill}>{skill}</span>)}</div>
        <p className={styles.summary}>{profile.professionalSummary}</p>
        {user.bio && <p className={styles.bio}>{user.bio}</p>}
        <div className={styles.heroCtas}>
          {data.services.length > 0 && <a href="#services" className={styles.primaryCta}>Book a service ↓</a>}
          {data.products.length > 0 && <a href="#shop" className={styles.secondaryCta}>Shop products ↓</a>}
          <a href={messageHref} className={styles.secondaryCta}>Message ↗</a>
        </div>
      </article>

      <aside className={styles.metaCard}>
        <div><small>PRIMARY CAPABILITY</small><strong>{profile.primarySkill}</strong></div>
        <div><small>CATEGORY</small><strong>{profile.category}</strong></div>
        <div><small>EXPERIENCE</small><strong>{profile.yearsExperience ?? 0}+ years</strong></div>
        <div><small>IDENTITY</small><strong>CLIENT + HUSTLER</strong></div>
        <p>This storefront is generated from the same Hustle identity that owns the work, offers, transactions and verified reputation shown here.</p>
      </aside>
    </section>

    <section className={styles.storeSection} id="services">
      <div className={styles.sectionHeader}>
        <div><p className={styles.sectionEyebrow}>WORK WITH ME</p><h2>Services</h2></div>
        <span>{data.counts.services} public</span>
      </div>
      {data.services.length === 0 ? <div className={styles.emptyState}>No public services yet. Message {targetLabel} to discuss a project.</div> : <div className={styles.serviceGrid}>
        {data.services.map((service) => <article className={styles.offerCard} key={service.id}>
          <a className={styles.offerMedia} href={`/services/${encodeURIComponent(service.id)}`}>
            {service.mediaUrls[0] ? <img src={service.mediaUrls[0]} alt="" /> : <span>{service.category ?? "SERVICE"}</span>}
          </a>
          <div className={styles.offerBody}>
            <div className={styles.offerMeta}><span>{service.deliveryMode.replaceAll("_", " ")}</span><span>{service.deliveryTime ?? "Ask for timing"}</span></div>
            <h3>{service.title}</h3>
            <p>{service.description}</p>
            <div className={styles.offerFooter}>
              <strong>{formatStorefrontServicePrice(service)}</strong>
              <a href={`/services/${encodeURIComponent(service.id)}`}>View & book →</a>
            </div>
          </div>
        </article>)}
      </div>}
    </section>

    <section className={styles.storeSection} id="work">
      <div className={styles.sectionHeader}>
        <div><p className={styles.sectionEyebrow}>PROOF OF CAPABILITY</p><h2>Work & content</h2></div>
        <span>{data.counts.posts} published</span>
      </div>
      {data.posts.length === 0 ? <div className={styles.emptyState}>No published work yet.</div> : <div className={styles.workGrid}>
        {data.posts.map((post) => {
          const media = firstPostMedia(post);
          return <a className={styles.workCard} key={post.id} href={`/posts/${encodeURIComponent(post.id)}`}>
            <div className={styles.workMedia}>
              {media?.mediaUrl && media.type === "IMAGE" && <img src={media.mediaUrl} alt="" />}
              {media?.mediaUrl && media.type === "VIDEO" && <video src={media.mediaUrl} muted playsInline preload="metadata" />}
              {!media?.mediaUrl && <span>{post.category ?? "HUSTLE WORK"}</span>}
            </div>
            <div className={styles.workBody}>
              <p>{post.caption ?? "View this work"}</p>
              <div><span>♥ {post._count.likes}</span><span>◌ {post._count.comments}</span></div>
              {(post.serviceAttachments.length > 0 || post.productAttachments.length > 0) && <small>Attached offer available</small>}
            </div>
          </a>;
        })}
      </div>}
    </section>

    <section className={styles.storeSection} id="shop">
      <div className={styles.sectionHeader}>
        <div><p className={styles.sectionEyebrow}>SHOP</p><h2>Products</h2></div>
        <span>{data.counts.products} public</span>
      </div>
      {data.products.length === 0 ? <div className={styles.emptyState}>No public products yet.</div> : <div className={styles.productGrid}>
        {data.products.map((product) => <article className={styles.productCard} key={product.id}>
          <a className={styles.productMedia} href={`/products/${encodeURIComponent(product.id)}`}>
            {product.mediaUrls[0] ? <img src={product.mediaUrls[0]} alt="" /> : <span>{product.type}</span>}
            <b className={product.inStock ? styles.stock : styles.outOfStock}>{product.inStock ? "IN STOCK" : "OUT OF STOCK"}</b>
          </a>
          <div className={styles.productBody}>
            <small>{product.category ?? product.type}</small>
            <h3>{product.title}</h3>
            <p>{product.description}</p>
            <div className={styles.offerFooter}>
              <strong>{formatStorefrontMoney(product.priceMinor, product.currency)}</strong>
              <a href={`/products/${encodeURIComponent(product.id)}`}>View product →</a>
            </div>
          </div>
        </article>)}
      </div>}
    </section>

    <section className={styles.reputationWrap} id="reviews">
      <div className={styles.sectionHeader}>
        <div><p className={styles.sectionEyebrow}>VERIFIED OUTCOMES</p><h2>Reputation</h2></div>
        <span>Transaction-backed only</span>
      </div>
      <PublicReputationPanel summary={trust} />
    </section>

    <section className={styles.closingCta}>
      <p className={styles.sectionEyebrow}>READY WHEN YOU ARE</p>
      <h2>Work with {targetLabel} through Hustle.</h2>
      <p>Book, buy or start a conversation from this storefront. Transactions and reputation stay attached to the same Hustle identity.</p>
      <div>
        {data.services.length > 0 && <a className={styles.primaryCta} href="#services">Choose a service</a>}
        {data.products.length > 0 && <a className={styles.secondaryCta} href="#shop">Browse products</a>}
        <a className={styles.secondaryCta} href={messageHref}>Message {targetLabel}</a>
      </div>
    </section>
  </main>;
}
