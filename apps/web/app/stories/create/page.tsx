"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { getMyProducts } from "../../../lib/product";
import { getMyServices } from "../../../lib/service";
import { createStory, type StoryType } from "../../../lib/story";
import styles from "../stories.module.css";

type OfferOption = { id: string; title: string | null; status: string };

const storyTypes: StoryType[] = ["TEXT", "IMAGE", "VIDEO"];

export default function CreateStoryPage() {
  const [type, setType] = useState<StoryType>("TEXT");
  const [text, setText] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [background, setBackground] = useState("#111111");
  const [serviceId, setServiceId] = useState("");
  const [productId, setProductId] = useState("");
  const [services, setServices] = useState<OfferOption[]>([]);
  const [products, setProducts] = useState<OfferOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.allSettled([getMyServices(), getMyProducts()]).then(([serviceResult, productResult]) => {
      if (!active) return;
      if (serviceResult.status === "fulfilled") {
        setServices(serviceResult.value.filter((service) => service.status === "PUBLISHED").map((service) => ({ id: service.id, title: service.title, status: service.status })));
      }
      if (productResult.status === "fulfilled") {
        setProducts(productResult.value.filter((product) => product.status === "PUBLISHED").map((product) => ({ id: product.id, title: product.title, status: product.status })));
      }
    });
    return () => {
      active = false;
    };
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
        <h1>Show what is happening now.</h1>
        <p>Create a lightweight text, photo or video Story. If you are a Hustler, attach one of your currently published Services or Products so viewers can move from attention to action.</p>
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
          <textarea id="story-text" maxLength={700} value={text} onChange={(event) => setText(event.target.value)} placeholder={type === "TEXT" ? "What do you want people to know right now?" : "Add context to what you are showing…"} />
          <span className={styles.hint}>{text.length}/700</span>
        </div>

        {type !== "TEXT" && <div className={styles.field}>
          <label htmlFor="story-media">{type === "IMAGE" ? "PHOTO URL" : "VIDEO URL"}</label>
          <input id="story-media" type="url" value={mediaUrl} onChange={(event) => setMediaUrl(event.target.value)} placeholder="https://…" required />
          <span className={styles.hint}>Phase 16A accepts an http/https media URL. Native Hustle media upload can layer onto this lifecycle without changing Story authority.</span>
        </div>}

        {type === "TEXT" && <div className={styles.field}>
          <label htmlFor="story-background">BACKGROUND</label>
          <input id="story-background" type="color" value={background} onChange={(event) => setBackground(event.target.value)} />
        </div>}

        <div className={styles.formGrid}>
          <div className={styles.field}>
            <label htmlFor="story-service">ATTACH PUBLISHED SERVICE · OPTIONAL</label>
            <select id="story-service" value={serviceId} onChange={(event) => setServiceId(event.target.value)}>
              <option value="">No service</option>
              {services.map((service) => <option key={service.id} value={service.id}>{service.title ?? "Untitled service"}</option>)}
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor="story-product">ATTACH PUBLISHED PRODUCT · OPTIONAL</label>
            <select id="story-product" value={productId} onChange={(event) => setProductId(event.target.value)}>
              <option value="">No product</option>
              {products.map((product) => <option key={product.id} value={product.id}>{product.title ?? "Untitled product"}</option>)}
            </select>
          </div>
        </div>

        {error && <div className={styles.notice}>{error}</div>}
        <button className={styles.submit} type="submit" disabled={!canSubmit || submitting}>{submitting ? "Publishing…" : "Publish Story for 24 hours →"}</button>
      </form>
    </section>
  </main>;
}
