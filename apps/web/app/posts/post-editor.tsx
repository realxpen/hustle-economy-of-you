"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getMarketplacePage } from "../../lib/search";
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
  const [mediaType, setMediaType] = useState<PostMediaType>("IMAGE");
  const [mediaUrl, setMediaUrl] = useState("");
  const [loading, setLoading] = useState(Boolean(postId));
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
        owner: item.owner.displayName ?? item.owner.username ?? "Hustle user"
      }] : []));
      setProducts(productPage.items.flatMap((item) => item.kind === "product" ? [{
        id: item.product.id,
        title: item.product.title,
        owner: item.owner.displayName ?? item.owner.username ?? "Hustle user"
      }] : []));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load public references");
    } finally {
      setLoadingReferences(false);
    }
  }

  useEffect(() => {
    let active = true;
    Promise.all([
      postId ? getMyPost(postId) : Promise.resolve(null),
      getMarketplacePage("services", { limit: 12 }),
      getMarketplacePage("products", { limit: 12 })
    ])
      .then(([loadedPost, servicePage, productPage]) => {
        if (!active) return;
        if (loadedPost) {
          setPost(loadedPost);
          setForm(toForm(loadedPost));
        }
        setServices(servicePage.items.flatMap((item) => item.kind === "service" ? [{
          id: item.service.id,
          title: item.service.title,
          owner: item.owner.displayName ?? item.owner.username ?? "Hustle user"
        }] : []));
        setProducts(productPage.items.flatMap((item) => item.kind === "product" ? [{
          id: item.product.id,
          title: item.product.title,
          owner: item.owner.displayName ?? item.owner.username ?? "Hustle user"
        }] : []));
      })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [postId]);

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
    if (!mediaUrl.trim()) return;
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

  if (loading) return <main className={styles.shell}><p className={styles.loading}>Loading post…</p></main>;

  return <main className={styles.shell}>
    <header className={styles.header}><a href="/posts/manage">← Posts</a><span>CONTENT · EVERY HUSTLE IDENTITY</span></header>

    <section className={styles.hero}>
      <div><p>CONTENT · {post?.status ?? "NEW DRAFT"}</p><h1>Share the experience. <em>Reference the opportunity.</em></h1></div>
      <div className={styles.status}><strong>{readiness}%</strong><span>publish ready</span></div>
    </section>
    <div className={styles.progress}><span style={{ width: `${readiness}%` }} /></div>

    <section className={styles.layout}>
      <form className={styles.form} onSubmit={persist}>
        <div className={styles.sectionTitle}><span>01</span><div><strong>What do you want to share?</strong><p>Posts belong to the Hustle user identity. You do not need to be a Hustler to publish.</p></div></div>
        <label><span>Caption *</span><textarea rows={7} maxLength={4000} value={form.caption} onChange={(event) => setForm((current) => ({ ...current, caption: event.target.value }))} placeholder="Share work, an experience, recommendation, review-style opinion or useful context. Use @username to reference a Hustle user." /></label>
        <div className={styles.twoCol}>
          <label><span>Topic / category *</span><input maxLength={100} value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} placeholder="Technology, Fashion, Experience…" /></label>
          <label><span>Location</span><input maxLength={160} value={form.location} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))} placeholder="Lagos, Nigeria" /></label>
        </div>
        <label><span>Tags · comma separated</span><input value={form.tags} onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))} placeholder="review, recommendation, react, lagos" /><small>Up to 20 tags. # is optional.</small></label>

        <div className={styles.sectionTitle}><span>02</span><div><strong>Media</strong><p>Use one video, one image, or multiple images for a carousel.</p></div></div>
        <div className={styles.twoCol}>
          <label><span>Media type</span><select value={mediaType} onChange={(event) => setMediaType(event.target.value as PostMediaType)} disabled={busy || Boolean(mediaCount > 0 && post?.media[0]?.type === "VIDEO")}><option value="IMAGE">Image</option><option value="VIDEO">Video</option></select></label>
          <label><span>Public media URL</span><input value={mediaUrl} onChange={(event) => setMediaUrl(event.target.value)} placeholder="https://…" /></label>
        </div>
        <div className={styles.actions}><button className={styles.secondary} type="button" onClick={addMedia} disabled={busy || !mediaUrl.trim()}>Add media</button></div>
        <div className={styles.variantList}>
          {post?.media.map((item, index) => <article className={styles.variantCard} key={item.id}>
            <strong>{index + 1}. {item.type}</strong>
            <p className={styles.muted}>{item.mediaUrl ?? item.storageKey ?? "No source"}</p>
            <div className={styles.variantActions}><button className={styles.dangerText} type="button" onClick={() => void removeMedia(item.id)} disabled={busy}>Remove</button></div>
          </article>)}
          {mediaCount === 0 && <p className={styles.muted}>No media yet. Publishing currently requires at least one media item.</p>}
        </div>

        <div className={styles.sectionTitle}><span>03</span><div><strong>Hustle references</strong><p>Reference any currently published Service or Product, including another Hustler's offer. Use @username in the caption to reference a person.</p></div></div>
        <label><span>Search public offers</span><div className={styles.twoCol}><input value={referenceQuery} onChange={(event) => setReferenceQuery(event.target.value)} placeholder="Search product, service or creator name" /><button className={styles.secondary} type="button" onClick={() => void loadReferences(referenceQuery.trim())} disabled={loadingReferences}>{loadingReferences ? "Searching…" : "Search"}</button></div></label>
        <div className={styles.variants}>
          <strong>Published services</strong>
          <div className={styles.variantList}>{services.length === 0 ? <p className={styles.muted}>No matching published services.</p> : services.map((service) => <label className={styles.check} key={service.id}><input type="checkbox" checked={attachedServiceIds.has(service.id)} onChange={() => void toggleService(service.id)} disabled={busy} /> {service.title ?? "Untitled service"} — {service.owner}</label>)}</div>
          <strong>Published products</strong>
          <div className={styles.variantList}>{products.length === 0 ? <p className={styles.muted}>No matching published products.</p> : products.map((product) => <label className={styles.check} key={product.id}><input type="checkbox" checked={attachedProductIds.has(product.id)} onChange={() => void toggleProduct(product.id)} disabled={busy} /> {product.title ?? "Untitled product"} — {product.owner}</label>)}</div>
        </div>

        <p className={styles.notice}>You can review or recommend something in a post. Hustle only counts a rating toward public reputation when the separate verified Booking/Order review flow says the transaction is eligible.</p>
        {error && <p className={styles.error}>{error}</p>}
        {notice && <p className={styles.notice}>{notice}</p>}
        <div className={styles.actions}>
          <button className={styles.secondary} type="submit" disabled={busy}>{busy ? "Working…" : "Save draft"}</button>
          {!published ? <button className={styles.primary} type="button" onClick={() => void publish()} disabled={busy}>Publish post ↗</button> : <button className={styles.secondary} type="button" onClick={() => void archive()} disabled={busy}>Archive post</button>}
          {currentId && post?.status === "PUBLISHED" && <a className={styles.publicLink} href={`/posts/${currentId}`} target="_blank" rel="noreferrer">Open public post ↗</a>}
        </div>
      </form>

      <aside className={styles.preview}>
        <p className={styles.previewLabel}>CONTENT PREVIEW</p>
        <div className={styles.media}>{post?.media[0]?.mediaUrl ? post.media[0].type === "VIDEO" ? <video src={post.media[0].mediaUrl} controls style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", background: `url(${post.media[0].mediaUrl}) center/cover` }} /> : <span>Post media</span>}</div>
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
