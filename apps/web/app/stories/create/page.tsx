"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { getMarketplacePage } from "../../../lib/search";
import { createStory, type StoryType } from "../../../lib/story";
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
  const [mediaUrl, setMediaUrl] = useState("");
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
      const message = reason instanceof Error ? reason.message : "Could not load public references";
      setError(message);
    } finally {
      setLoadingReferences(false);
    }
  }

  useEffect(() => {
    void loadReferences();
  }, []);

  const canSubmit = useMemo(() => {
    if (type === "TEXT") return text.trim().length > 0;
    return mediaUrl.trim().length > 0;
  }, [mediaUrl, text, type]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const story = await createStory({
        type,
        text: text.trim() || null,
        mediaUrl: type === "TEXT" ? null : mediaUrl.trim(),
        background: type === "TEXT" ? background : null,
        serviceId: serviceId || null,
        productId: productId || null
      });
      window.location.assign(`/stories/${story.id}`);
    } catch (reason) {
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

    <section className={styles.formShell}>
      <div className={styles.formHeader}>
        <p className={styles.eyebrow}>CREATE · EXPIRES IN 24 HOURS</p>
        <h1>Share what is happening now.</h1>
        <p>Every Hustle user can publish a Story. You can share an experience, recommendation, review-style opinion, update or proof of work. Mention people with <strong>@username</strong>, and optionally reference any currently published Service or Product on Hustle.</p>
      </div>

      <div className={styles.typeTabs}>
        {storyTypes.map((storyType) => <button
          key={storyType}
          type="button"
          className={type === storyType ? styles.activeType : undefined}
          onClick={() => setType(storyType)}
        >{storyType === "TEXT" ? "Text" : storyType === "IMAGE" ? "Photo" : "Video"}</button>)}
      </div>

      <form className={styles.form} onSubmit={submit}>
        <div className={styles.field}>
          <label htmlFor="story-text">{type === "TEXT" ? "STORY TEXT" : "CAPTION · OPTIONAL"}</label>
          <textarea id="story-text" maxLength={700} value={text} onChange={(event) => setText(event.target.value)} placeholder={type === "TEXT" ? "Share an update, review or recommendation. Use @username to reference someone…" : "Add context or @mention someone…"} />
          <span className={styles.hint}>{text.length}/700 · @mentions resolve to public Hustle identities.</span>
        </div>

        {type !== "TEXT" && <div className={styles.field}>
          <label htmlFor="story-media">{type === "IMAGE" ? "PHOTO URL" : "VIDEO URL"}</label>
          <input id="story-media" type="url" value={mediaUrl} onChange={(event) => setMediaUrl(event.target.value)} placeholder="https://…" required />
          <span className={styles.hint}>Native Hustle media upload is the next media layer; this lifecycle currently accepts an http/https media URL.</span>
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
          <span className={styles.hint}>The referenced offer does not have to belong to you. This is how a Client can recommend or review a Hustler's work without becoming a Hustler.</span>
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

        <div className={styles.notice}>
          A Story or post can contain your opinion or recommendation. It only becomes a <strong>verified transaction review</strong> in Hustle's reputation system when the separate review eligibility rules from a completed Booking/Order are satisfied.
        </div>

        {error && <div className={styles.notice}>{error}</div>}
        <button className={styles.submit} type="submit" disabled={!canSubmit || submitting}>{submitting ? "Publishing…" : "Publish Story for 24 hours →"}</button>
      </form>
    </section>
  </main>;
}
