"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ExperienceState } from "../../components/experience/experience-state";
import { useRouter } from "next/navigation";
import { getMarketplacePage } from "../../lib/search";
import { getMyAccount } from "../../lib/auth/hustle-account";
import {
  addPostMedia,
  archivePost,
  attachPostProduct,
  attachPostService,
  createPost,
  detachPostProduct,
  detachPostService,
  getMyPost,
  publishPost,
  removePostMedia,
  savePost,
  type Post,
  type PostMediaType
} from "../../lib/post";
import styles from "../products/product-editor.module.css";

type PostForm = {
  caption: string;
  category: string;
  location: string;
  tags: string;
};

type OfferOption = {
  id: string;
  title: string | null;
  owner: string;
  ownerUserId: string;
};

const emptyForm: PostForm = { caption: "", category: "", location: "", tags: "" };

function toForm(post: Post): PostForm {
  return {
    caption: post.caption ?? "",
    category: post.category ?? "",
    location: post.location ?? "",
    tags: post.tags.join(", ")
  };
}

function parseTags(value: string) {
  return value.split(",").map((item) => item.trim().replace(/^#/, "")).filter(Boolean);
}

export default function PostEditor({ postId }: { postId?: string }) {
  const router = useRouter();
  const [post, setPost] = useState<Post | null>(null);
  const [form, setForm] = useState<PostForm>(emptyForm);
  const [services, setServices] = useState<OfferOption[]>([]);
  const [products, setProducts] = useState<OfferOption[]>([]);
  const [referenceQuery, setReferenceQuery] = useState("");
  const [viewerUserId, setViewerUserId] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<PostMediaType>("IMAGE");
  const [mediaUrl, setMediaUrl] = useState("");
  const [loading, setLoading] = useState(Boolean(postId));
  const [retry, setRetry] = useState(0);
  const [loadingReferences, setLoadingReferences] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function loadReferences(query = "") {
    setLoadingReferences(true);
    try {
      const [servicePage, productPage] = await Promise.all([
        getMarketplacePage("services", { q: query, limit: 12 }),
        getMarketplacePage("products", { q: query, limit: 12 })
      ]);
      setServices(servicePage.items.flatMap((item) => item.kind === "service" ? [{
        id: item.service.id,
        title: item.service.title,
        owner: item.owner.displayName ?? item.owner.username ?? "Hustle user",
        ownerUserId: item.owner.id
      }] : []));
      setProducts(productPage.items.flatMap((item) => item.kind === "product" ? [{
        id: item.product.id,
        title: item.product.title,
        owner: item.owner.displayName ?? item.owner.username ?? "Hustle user",
        ownerUserId: item.owner.id
      }] : []));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load public references");
    } finally {
      setLoadingReferences(false);
    }
  }

  useEffect(() => {
    let active = true;
    setLoading(Boolean(postId));
    setError(null);
    Promise.all([
      postId ? getMyPost(postId) : Promise.resolve(null),
      getMarketplacePage("services", { limit: 12 }),
      getMarketplacePage("products", { limit: 12 }),
      getMyAccount().catch(() => null)
    ])
      .then(([loadedPost, servicePage, productPage, account]) => {
        if (active) setViewerUserId(account?.id ?? null);
        if (!active) return;
        if (loadedPost) {
          setPost(loadedPost);
          setForm(toForm(loadedPost));
        }
        setServices(servicePage.items.flatMap((item) => item.kind === "service" ? [{
          id: item.service.id,
          title: item.service.title,
          owner: item.owner.displayName ?? item.owner.username ?? "Hustle user",
        ownerUserId: item.owner.id
        }] : []));
        setProducts(productPage.items.flatMap((item) => item.kind === "product" ? [{
          id: item.product.id,
          title: item.product.title,
          owner: item.owner.displayName ?? item.owner.username ?? "Hustle user",
        ownerUserId: item.owner.id
        }] : []));
      })
      .catch((reason: Error) => { if (active) setError(reason.message); })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [postId, retry]);

  const currentId = post?.id ?? postId;
  const published = post?.status === "PUBLISHED";
  const mediaCount = post?.media.length ?? 0;
  const readiness = Math.round(([form.caption.trim(), form.category.trim(), mediaCount > 0].filter(Boolean).length / 3) * 100);
  const attachedServiceIds = useMemo(() => new Set(post?.serviceAttachments.map((item) => item.serviceId) ?? []), [post]);
  const attachedProductIds = useMemo(() => new Set(post?.productAttachments.map((item) => item.productId) ?? []), [post]);

  function buildInput() {
    return {
      caption: form.caption,
      category: form.category,
      location: form.location,
      tags: parseTags(form.tags)
    };
  }

  async function ensurePost() {
    const next = currentId ? await savePost(currentId, buildInput()) : await createPost(buildInput());
    setPost(next);
    setForm(toForm(next));
    if (!currentId) router.replace(`/posts/${next.id}/edit`);
    return next;
  }

  async function persist(event?: FormEvent) {
    event?.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await ensurePost();
      setNotice("Post draft saved.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save post");
    } finally {
      setBusy(false);
    }
  }

  async function addMedia() {
    if (busy || !mediaUrl.trim()) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const saved = await ensurePost();
      const next = await addPostMedia(saved.id, { type: mediaType, mediaUrl: mediaUrl.trim() });
      setPost(next);
      setMediaUrl("");
      setNotice(mediaType === "VIDEO" ? "Video attached." : "Image attached.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not add media");
    } finally {
      setBusy(false);
    }
  }

  async function removeMedia(mediaId: string) {
    if (!currentId) return;
    setBusy(true);
    setError(null);
    try {
      const next = await removePostMedia(currentId, mediaId);
      setPost(next);
      setNotice("Media removed.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not remove media");
    } finally {
      setBusy(false);
    }
  }

  async function toggleService(serviceId: string) {
    setBusy(true);
    setError(null);
    try {
      const saved = await ensurePost();
      const next = attachedServiceIds.has(serviceId)
        ? await detachPostService(saved.id, serviceId)
        : await attachPostService(saved.id, serviceId);
      setPost(next);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update service reference");
    } finally {
      setBusy(false);
    }
  }

  async function toggleProduct(productId: string) {
    setBusy(true);
    setError(null);
    try {
      const saved = await ensurePost();
      const next = attachedProductIds.has(productId)
        ? await detachPostProduct(saved.id, productId)
        : await attachPostProduct(saved.id, productId);
      setPost(next);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update product reference");
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (busy || !form.caption.trim() || !form.category.trim() || mediaCount === 0) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const saved = await ensurePost();
      const next = await publishPost(saved.id);
      setPost(next);
      setNotice("Post published to Hustle discovery.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not publish post");
    } finally {
      setBusy(false);
    }
  }

  async function archive() {
    if (!currentId) return;
    setBusy(true);
    setError(null);
    try {
      const next = await archivePost(currentId);
      setPost(next);
      setNotice("Post archived. It is no longer public.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not archive post");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <main className={styles.shell}><ExperienceState kind="loading" title="Loading your post…" /></main>;
  if (error && postId && !post) return <main className={styles.shell}>
    <ExperienceState kind="error" title="Could not open this draft." description={error}
      action={{ label: "Try again", onClick:()=>setRetry((count)=>count+1) }} />
  </main>;

  return <main className={styles.shell}>
    <header className={styles.header}><a href="/posts/manage">← Posts</a><span>CONTENT · EVERY HUSTLE IDENTITY</span></header>

    <section className={styles.hero}>
      <div><p>CONTENT · {post?.status ?? "NEW DRAFT"}</p><h1>Share the experience. <em>Reference the opportunity.</em></h1></div>
      <div className={styles.status}><strong>{readiness}%</strong><span>draft checklist</span></div>
    </section>
    <div className={styles.progress} aria-hidden="true"><span style={{ width: `${readiness}%` }} /></div>
    <p className={styles.muted} role="status">Publish checklist: {form.caption.trim() ? "Caption ✓" : "Caption needed"} · {form.category.trim() ? "Category ✓" : "Category needed"} · {mediaCount > 0 ? "Media ✓" : "Media needed"}. Saving a draft is separate from publishing.</p>

    <nav className={styles.creatorNav} aria-label="Choose how to share your work">
      <span aria-current="step">Post</span>
      <a href="/stories/create">Story · 24 hours</a>
      <a href="/live/create">Host a Live</a>
      <a href="/professional-profile">Professional storefront</a>
    </nav>
    <section className={styles.layout}>
      <form className={styles.form} onSubmit={persist} aria-busy={busy}>
        <div className={styles.sectionTitle}><span>01</span><div><strong>What do you want to share?</strong><p>Posts belong to the Hustle user identity. You do not need to be a Hustler to publish.</p></div></div>
        <label><span>Caption *</span><textarea rows={7} maxLength={4000} value={form.caption} onChange={(event) => setForm((current) => ({ ...current, caption: event.target.value }))} placeholder="Share work, an experience, recommendation, review-style opinion or useful context. Use @username to reference a Hustle user." /><small>{form.caption.length}/4000 characters · Describe your experience or demonstration.</small></label>
        <div className={styles.twoCol}>
          <label><span>Topic / category *</span><input maxLength={100} value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} placeholder="Technology, Fashion, Experience…" /></label>
          <label><span>Location</span><input maxLength={160} value={form.location} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))} placeholder="Lagos, Nigeria" /></label>
        </div>
        <label><span>Tags · comma separated</span><input value={form.tags} onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))} placeholder="review, recommendation, react, lagos" /><small>Up to 20 tags. # is optional.</small></label>

        <div className={styles.sectionTitle}><span>02</span><div><strong>Media</strong><p>Use one video, one image, or multiple images for a carousel.</p></div></div>
        <div className={styles.twoCol}>
          <label><span>Media type</span><select value={mediaType} onChange={(event) => setMediaType(event.target.value as PostMediaType)} disabled={busy || Boolean(mediaCount > 0 && post?.media[0]?.type === "VIDEO")}><option value="IMAGE">Image</option><option value="VIDEO">Video</option></select></label>
          <label><span>Public media URL</span><input type="url" inputMode="url" value={mediaUrl} onChange={(event) => setMediaUrl(event.target.value)} placeholder="https://…" /></label>
        </div>
        <div className={styles.actions}><button className={styles.secondary} type="button" onClick={addMedia} disabled={busy || !mediaUrl.trim()}>{busy ? "Working…" : "Add media"}</button></div>
        <div className={styles.variantList}>
          {post?.media.map((item, index) => <article className={styles.variantCard} key={item.id}>
            <strong>{index + 1}. {item.type}</strong>
            {item.mediaUrl && (item.type === "VIDEO" ? <video src={item.mediaUrl} controls preload="metadata" style={{width:"100%",maxHeight:200,objectFit:"contain",borderRadius:12}} /> : <img src={item.mediaUrl} loading="lazy" alt={`Attached post image ${index+1}`} style={{width:"100%",maxHeight:200,objectFit:"contain",borderRadius:12}} />)}
            <p className={styles.muted}>{item.mediaUrl ?? item.storageKey ?? "No source"}</p>
            <div className={styles.variantActions}><button className={styles.dangerText} type="button" onClick={() => void removeMedia(item.id)} disabled={busy}>Remove</button></div>
          </article>)}
          {mediaCount === 0 && <p className={styles.muted}>No media yet. Add one image or video to publish; incomplete drafts can still be saved.</p>}
        </div>

        <div className={styles.sectionTitle}><span>03</span><div><strong>Link an offer to your post</strong><p>All published services and products can be discovered by every Hustle account. Link your own listing to promote it, or mention another Hustler's offer as a recommendation. Linking does not transfer ownership or count as a verified review.</p></div></div>
        <label><span>Search public offers</span><div className={styles.twoCol}><input type="search" value={referenceQuery} onChange={(event) => setReferenceQuery(event.target.value)} placeholder="Search product, service or creator name" /><button className={styles.secondary} type="button" onClick={() => void loadReferences(referenceQuery.trim())} disabled={loadingReferences}>{loadingReferences ? "Searching…" : "Search"}</button></div></label>
        <div className={styles.variants}>
          <strong>Published services</strong>
          <div className={styles.variantList}>{services.length === 0 ? <p className={styles.muted}>No matching published services.</p> : services.map((service) => <label className={styles.check} key={service.id}><input type="checkbox" checked={attachedServiceIds.has(service.id)} onChange={() => void toggleService(service.id)} disabled={busy} /> {service.title ?? "Untitled service"} <small>· {viewerUserId && service.ownerUserId === viewerUserId ? "Your service" : `Offered by ${service.owner} · Public reference`}</small></label>)}</div>
          <strong>Published products</strong>
          <div className={styles.variantList}>{products.length === 0 ? <p className={styles.muted}>No matching published products.</p> : products.map((product) => <label className={styles.check} key={product.id}><input type="checkbox" checked={attachedProductIds.has(product.id)} onChange={() => void toggleProduct(product.id)} disabled={busy} /> {product.title ?? "Untitled product"} <small>· {viewerUserId && product.ownerUserId === viewerUserId ? "Your product" : `Sold by ${product.owner} · Public reference`}</small></label>)}</div>
        </div>

        <p className={styles.notice}>An attached service or product always belongs to its original seller. Anyone may link a public offer, but a post or #review tag is not a transaction-verified rating. Only the separate verified Booking/Order review flow affects reputation.</p>
        {error && <p className={styles.error} role="alert">{error}</p>}
        {notice && <p className={styles.notice} role="status">{notice}</p>}
        <div className={styles.actions}>
          <button className={styles.secondary} type="submit" disabled={busy}>{busy ? "Working…" : "Save draft"}</button>
          {!published ? <button className={styles.primary} type="button" onClick={() => void publish()} disabled={busy || !form.caption.trim() || !form.category.trim() || mediaCount === 0}>Publish post ↗</button> : <button className={styles.secondary} type="button" onClick={() => void archive()} disabled={busy}>Archive post</button>}
          {currentId && post?.status === "PUBLISHED" && <a className={styles.publicLink} href={`/posts/${currentId}`} target="_blank" rel="noreferrer">Open public post ↗</a>}
        </div>
        {!published && (!form.caption.trim() || !form.category.trim() || mediaCount === 0) && <p className={styles.muted}>To publish: add a caption, category and media. You can save your work as a draft first.</p>}
      </form>

      <aside className={styles.preview}>
        <p className={styles.previewLabel}>CONTENT PREVIEW</p>
        <div className={styles.media}>{post?.media[0]?.mediaUrl ? post.media[0].type === "VIDEO" ? <video src={post.media[0].mediaUrl} controls style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <img src={post.media[0].mediaUrl} alt="Post image preview" style={{width:"100%",height:"100%",objectFit:"cover"}} /> : <span>Post media</span>}</div>
        <div className={styles.previewBody}>
          <span className={styles.badge}>{form.category || "CATEGORY"}</span>
          <h2>{form.caption ? form.caption.slice(0, 72) : "What you want to share"}</h2>
          <p>{form.location || "Location optional"}</p>
          <div className={styles.previewMeta}><span>{mediaCount} media</span><span>{attachedServiceIds.size + attachedProductIds.size} references</span></div>
        </div>
      </aside>
    </section>
  </main>;
}
