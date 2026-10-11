"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";

import { getMarketplacePage } from "../../../lib/search";
import {
  createStory,
  removeStoryMedia,
  uploadStoryMedia,
  type StoryType
} from "../../../lib/story";
import styles from "../stories.module.css";

type OfferOption = {
  id: string;
  title: string | null;
  owner: string;
};

const storyTypes: StoryType[] = ["TEXT", "IMAGE", "VIDEO"];

export default function CreateStoryPage() {
  const [type, setType] = useState<StoryType>("TEXT");
  const [text, setText] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState<string | null>(null);
  const [background, setBackground] = useState("#111111");
  const [serviceId, setServiceId] = useState("");
  const [productId, setProductId] = useState("");
  const [referenceQuery, setReferenceQuery] = useState("");
  const [services, setServices] = useState<OfferOption[]>([]);
  const [products, setProducts] = useState<OfferOption[]>([]);
  const [loadingReferences, setLoadingReferences] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadReferences(query = "") {
    setLoadingReferences(true);
    setError(null);
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
    void loadReferences();
  }, []);

  const mediaValidation = useMemo(() => {
    if (type === "TEXT" || !mediaFile) return null;
    const allowed = type === "IMAGE"
      ? ["image/jpeg","image/png","image/webp","image/gif"]
      : ["video/mp4","video/webm","video/quicktime"];
    const limit = type === "IMAGE" ? 10 * 1024 * 1024 : 50 * 1024 * 1024;
    if (!allowed.includes(mediaFile.type)) return "Choose a supported " + (type === "IMAGE" ? "image" : "video") + " file.";
    if (mediaFile.size <= 0 || mediaFile.size > limit) return "File must be larger than zero and at most " + (type === "IMAGE" ? "10 MB." : "50 MB.");
    return null;
  }, [mediaFile, type]);

  useEffect(() => {
    if (!mediaFile || type === "TEXT" || mediaValidation) {
      setMediaPreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(mediaFile);
    setMediaPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [mediaFile, type, mediaValidation]);

  const canSubmit = useMemo(() => {
    if (type === "TEXT") return text.trim().length > 0;
    return Boolean(mediaFile && !mediaValidation);
  }, [mediaFile, mediaValidation, text, type]);

  function chooseType(next: StoryType) {
    setType(next);
    setMediaFile(null);
    setError(null);
  }

  function chooseMedia(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setMediaFile(file);
    setError(null);
    event.target.value = "";
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);

    let uploadedStorageKey: string | null = null;
    try {
      const uploaded = type !== "TEXT" && mediaFile
        ? await uploadStoryMedia(mediaFile, type)
        : null;
      uploadedStorageKey = uploaded?.mediaStorageKey ?? null;

      const story = await createStory({
        type,
        text: text.trim() || null,
        mediaUrl: uploaded?.mediaUrl ?? null,
        mediaStorageKey: uploaded?.mediaStorageKey ?? null,
        background: type === "TEXT" ? background : null,
        serviceId: serviceId || null,
        productId: productId || null
      });
      window.location.assign(`/stories/${story.id}`);
    } catch (reason) {
      if (uploadedStorageKey) {
        await removeStoryMedia(uploadedStorageKey).catch(() => undefined);
      }
      const message = reason instanceof Error ? reason.message : "Could not publish Story";
      setError(message);
      if (message.toLowerCase().includes("sign in")) {
        window.setTimeout(() => window.location.assign("/auth"), 900);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return <main className={styles.shell}>
    <header className={styles.header}>
      <a className={styles.brand} href="/stories">← STORIES</a>
      <div className={styles.headerActions}><a href="/home">Discovery</a></div>
    </header>

    <nav className={styles.creatorModes} aria-label="Choose a content format">
      <a href="/posts/new">Post · feed</a>
      <span aria-current="step">Story · 24 hours</span>
      <a href="/live/create">Live · real time</a>
      <a href="/professional-profile">Your storefront</a>
    </nav>
    <section className={styles.formShell}>
      <div className={styles.formHeader}>
        <p className={styles.eyebrow}>CREATE · EXPIRES IN 24 HOURS</p>
        <h1>Share what is happening now.</h1>
        <p>Every Hustle user can publish a Story. Share an experience, recommendation, update or proof of work, mention people with <strong>@username</strong>, and reference any currently published Service or Product.</p>
      </div>

      <div className={styles.typeTabs}>
        {storyTypes.map((storyType) => <button
          key={storyType}
          type="button"
          className={type === storyType ? styles.activeType : undefined}
          aria-pressed={type === storyType}
          onClick={() => chooseType(storyType)}
        >{storyType === "TEXT" ? "Text" : storyType === "IMAGE" ? "Photo" : "Video"}</button>)}
      </div>

      <form className={styles.form} onSubmit={submit} aria-busy={submitting}>
        <section className={styles.storyPreview} aria-label="Story preview">
          <div className={styles.storyPreviewStage} style={type === "TEXT" ? { background } : undefined}>
            {type === "TEXT" && <p>{text.trim() || "Your Story will appear here…"}</p>}
            {type === "IMAGE" && (mediaPreviewUrl
              ? <img src={mediaPreviewUrl} alt="Selected Story photo preview" />
              : <p>Select a photo to preview</p>)}
            {type === "VIDEO" && (mediaPreviewUrl
              ? <video src={mediaPreviewUrl} controls playsInline preload="metadata" aria-label="Selected Story video preview" />
              : <p>Select a video to preview</p>)}
          </div>
          <p className={styles.hint}>Preview only. Nothing is posted until you choose Publish Story. Stories expire after 24 hours.</p>
        </section>
        <div className={styles.field}>
          <label htmlFor="story-text">{type === "TEXT" ? "STORY TEXT" : "CAPTION · OPTIONAL"}</label>
          <textarea id="story-text" maxLength={700} value={text} onChange={(event) => setText(event.target.value)} placeholder={type === "TEXT" ? "Share an update, review or recommendation. Use @username to reference someone…" : "Add context or @mention someone…"} />
          <span className={styles.hint}>{text.length}/700 · @mentions resolve to public Hustle identities.</span>
        </div>

        {type !== "TEXT" && <div className={styles.field}>
          <label htmlFor="story-media">{type === "IMAGE" ? "UPLOAD PHOTO" : "UPLOAD VIDEO"}</label>
          <input
            id="story-media"
            key={type}
            type="file"
            accept={type === "IMAGE" ? "image/jpeg,image/png,image/webp,image/gif" : "video/mp4,video/webm,video/quicktime"}
            onChange={chooseMedia}
            required
          />
          {mediaValidation && <span className={styles.mediaError} role="alert">{mediaValidation}</span>}
          <span className={styles.hint}>
            {mediaFile ? `${mediaFile.name} · ${(mediaFile.size / 1024 / 1024).toFixed(1)} MB` : type === "IMAGE" ? "JPEG, PNG, WebP or GIF · up to 10 MB" : "MP4, WebM or QuickTime · up to 50 MB"}
          </span>
        </div>}

        {type === "TEXT" && <div className={styles.field}>
          <label htmlFor="story-background">BACKGROUND</label>
          <input id="story-background" type="color" value={background} onChange={(event) => setBackground(event.target.value)} />
        </div>}

        <div className={styles.field}>
          <label htmlFor="reference-search">REFERENCE SOMETHING ON HUSTLE · OPTIONAL</label>
          <div className={styles.formGrid}>
            <input id="reference-search" value={referenceQuery} onChange={(event) => setReferenceQuery(event.target.value)} placeholder="Search a product, service or creator name" />
            <button type="button" className={styles.submit} onClick={() => void loadReferences(referenceQuery.trim())} disabled={loadingReferences}>{loadingReferences ? "Searching…" : "Search Hustle references"}</button>
          </div>
          <span className={styles.hint}>The referenced offer does not have to belong to you. A Client can recommend a Hustler's work without becoming a Hustler.</span>
        </div>

        <div className={styles.formGrid}>
          <div className={styles.field}>
            <label htmlFor="story-service">REFERENCE PUBLISHED SERVICE</label>
            <select id="story-service" value={serviceId} onChange={(event) => setServiceId(event.target.value)}>
              <option value="">No service reference</option>
              {services.map((service) => <option key={service.id} value={service.id}>{service.title ?? "Untitled service"} — {service.owner}</option>)}
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor="story-product">REFERENCE PUBLISHED PRODUCT</label>
            <select id="story-product" value={productId} onChange={(event) => setProductId(event.target.value)}>
              <option value="">No product reference</option>
              {products.map((product) => <option key={product.id} value={product.id}>{product.title ?? "Untitled product"} — {product.owner}</option>)}
            </select>
          </div>
        </div>

        <div className={styles.notice}>Story opinions remain community content. Verified reputation still requires an eligible completed Booking/Order and the separate verified Review flow.</div>
        {error && <div className={styles.mediaError} role="alert">{error}</div>}
        <button className={styles.submit} type="submit" disabled={!canSubmit || submitting} aria-disabled={!canSubmit || submitting}>{submitting ? "Uploading & publishing…" : "Publish Story for 24 hours →"}</button>
      </form>
    </section>
  </main>;
}
