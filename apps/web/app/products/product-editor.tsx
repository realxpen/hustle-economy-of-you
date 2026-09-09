"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Product, ProductType, ProductVariant } from "@hustle/types";
import {
  createProduct,
  createProductVariant,
  deleteProduct,
  deleteProductVariant,
  formatProductPrice,
  getMyProduct,
  pauseProduct,
  publishProduct,
  saveProduct,
  saveProductVariant
} from "../../lib/product";
import styles from "./product-editor.module.css";

type ProductForm = {
  title: string;
  category: string;
  description: string;
  mediaUrls: string;
  type: ProductType;
  price: string;
  trackInventory: boolean;
  inventoryQuantity: string;
  deliveryInformation: string;
};

const emptyForm: ProductForm = {
  title: "",
  category: "",
  description: "",
  mediaUrls: "",
  type: "PHYSICAL",
  price: "",
  trackInventory: true,
  inventoryQuantity: "",
  deliveryInformation: ""
};

function toForm(product: Product): ProductForm {
  return {
    title: product.title ?? "",
    category: product.category ?? "",
    description: product.description ?? "",
    mediaUrls: product.mediaUrls.join("\n"),
    type: product.type,
    price: product.priceMinor === null ? "" : String(product.priceMinor / 100),
    trackInventory: product.trackInventory,
    inventoryQuantity: product.inventoryQuantity === null ? "" : String(product.inventoryQuantity),
    deliveryInformation: product.deliveryInformation ?? ""
  };
}

function toMinor(value: string): number | null {
  if (!value.trim()) return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100);
}

function parseOptions(value: string) {
  const result: Record<string, string> = {};
  value.split(",").map((item) => item.trim()).filter(Boolean).forEach((item) => {
    const [rawKey, ...rest] = item.split("=");
    const key = rawKey?.trim();
    const option = rest.join("=").trim();
    if (key && option) result[key] = option;
  });
  return result;
}

function optionsToText(options: Record<string, string> | null) {
  return Object.entries(options ?? {}).map(([key, value]) => `${key}=${value}`).join(", ");
}

function VariantRow({ productId, variant, onChanged }: { productId: string; variant: ProductVariant; onChanged: () => Promise<void> }) {
  const [name, setName] = useState(variant.name);
  const [sku, setSku] = useState(variant.sku ?? "");
  const [options, setOptions] = useState(optionsToText(variant.optionValues));
  const [price, setPrice] = useState(variant.priceOverrideMinor === null ? "" : String(variant.priceOverrideMinor / 100));
  const [quantity, setQuantity] = useState(variant.inventoryQuantity === null ? "" : String(variant.inventoryQuantity));
  const [active, setActive] = useState(variant.isActive);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await saveProductVariant(productId, variant.id, {
        name,
        sku: sku || null,
        optionValues: parseOptions(options),
        priceOverrideMinor: toMinor(price),
        inventoryQuantity: quantity === "" ? null : Number(quantity),
        isActive: active
      });
      await onChanged();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save variant");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Delete variant “${variant.name}”?`)) return;
    setBusy(true);
    setError(null);
    try {
      await deleteProductVariant(productId, variant.id);
      await onChanged();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not delete variant");
    } finally {
      setBusy(false);
    }
  }

  return <article className={styles.variantCard}>
    <div className={styles.variantGrid}>
      <label><span>Name *</span><input value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label><span>SKU</span><input value={sku} onChange={(event) => setSku(event.target.value)} placeholder="SKU-001" /></label>
      <label className={styles.wide}><span>Options</span><input value={options} onChange={(event) => setOptions(event.target.value)} placeholder="Size=Large, Color=Black" /></label>
      <label><span>Price override (₦)</span><input type="number" min="0" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} /></label>
      <label><span>Variant stock</span><input type="number" min="0" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label>
    </div>
    <div className={styles.variantActions}>
      <label className={styles.check}><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /> Active</label>
      <button type="button" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save variant"}</button>
      <button className={styles.dangerText} type="button" onClick={remove} disabled={busy}>Delete</button>
    </div>
    {error && <p className={styles.error}>{error}</p>}
  </article>;
}

export default function ProductEditor({ productId }: { productId?: string }) {
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [loading, setLoading] = useState(Boolean(productId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [variantName, setVariantName] = useState("");
  const [variantSku, setVariantSku] = useState("");
  const [variantOptions, setVariantOptions] = useState("");

  useEffect(() => {
    if (!productId) return;
    getMyProduct(productId)
      .then((next) => {
        setProduct(next);
        setForm(toForm(next));
      })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, [productId]);

  const media = useMemo(() => form.mediaUrls.split("\n").map((item) => item.trim()).filter(Boolean), [form.mediaUrls]);
  const currentId = product?.id ?? productId;
  const published = product?.status === "PUBLISHED";
  const readyChecks = [form.title.trim(), form.category.trim(), form.description.trim(), media.length > 0, form.price.trim()];
  if (form.type === "PHYSICAL") readyChecks.push(form.deliveryInformation.trim());
  if (form.trackInventory) readyChecks.push(form.inventoryQuantity.trim());
  const readiness = Math.round((readyChecks.filter(Boolean).length / readyChecks.length) * 100);

  function setField<K extends keyof ProductForm>(key: K, value: ProductForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function buildInput() {
    return {
      title: form.title,
      category: form.category,
      description: form.description,
      mediaUrls: media,
      type: form.type,
      priceMinor: toMinor(form.price),
      trackInventory: form.trackInventory,
      inventoryQuantity: form.trackInventory && form.inventoryQuantity !== "" ? Number(form.inventoryQuantity) : null,
      deliveryInformation: form.deliveryInformation
    };
  }

  async function persist(event?: FormEvent) {
    event?.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const next = currentId
        ? await saveProduct(currentId, buildInput())
        : await createProduct(buildInput());
      setProduct(next);
      setForm(toForm(next));
      setNotice("Product draft saved.");
      if (!currentId) router.replace(`/products/${next.id}/edit`);
      return next;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save product");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const saved = currentId
        ? await saveProduct(currentId, buildInput())
        : await createProduct(buildInput());
      const next = await publishProduct(saved.id);
      setProduct(next);
      setForm(toForm(next));
      setNotice("Product published. It is now publicly discoverable.");
      if (!currentId) router.replace(`/products/${next.id}/edit`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not publish product");
    } finally {
      setBusy(false);
    }
  }

  async function pause() {
    if (!currentId) return;
    setBusy(true);
    setError(null);
    try {
      const next = await pauseProduct(currentId);
      setProduct(next);
      setNotice("Product paused. Its public page is no longer available.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not pause product");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!currentId || !window.confirm("Delete this product permanently?")) return;
    setBusy(true);
    setError(null);
    try {
      await deleteProduct(currentId);
      router.push("/products/manage");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not delete product");
      setBusy(false);
    }
  }

  async function refreshProduct() {
    if (!currentId) return;
    const next = await getMyProduct(currentId);
    setProduct(next);
  }

  async function addVariant() {
    if (!currentId) return;
    setBusy(true);
    setError(null);
    try {
      await createProductVariant(currentId, {
        name: variantName,
        sku: variantSku || null,
        optionValues: parseOptions(variantOptions)
      });
      setVariantName("");
      setVariantSku("");
      setVariantOptions("");
      await refreshProduct();
      setNotice("Variant added.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not add variant");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <main className={styles.shell}><p className={styles.loading}>Loading product…</p></main>;

  return <main className={styles.shell}>
    <header className={styles.header}>
      <a href="/products/manage">← Products</a>
      <span>PHASE 6 · PRODUCT ECONOMY</span>
    </header>

    <section className={styles.hero}>
      <div>
        <p>PRODUCT · {product?.status ?? "NEW DRAFT"}</p>
        <h1>Turn an item into an <em>offer.</em></h1>
      </div>
      <div className={styles.status}><strong>{readiness}%</strong><span>publish ready</span></div>
    </section>

    <div className={styles.progress}><span style={{ width: `${readiness}%` }} /></div>

    <section className={styles.layout}>
      <form className={styles.form} onSubmit={persist}>
        <div className={styles.sectionTitle}><span>01</span><div><strong>Product basics</strong><p>Describe exactly what a buyer will receive.</p></div></div>
        <label><span>Title *</span><input maxLength={160} value={form.title} onChange={(event) => setField("title", event.target.value)} placeholder="e.g. Hustle Creator Toolkit" /></label>
        <div className={styles.twoCol}>
          <label><span>Category *</span><input maxLength={100} value={form.category} onChange={(event) => setField("category", event.target.value)} placeholder="Digital tools" /></label>
          <label><span>Product type *</span><select value={form.type} onChange={(event) => setField("type", event.target.value as ProductType)}><option value="PHYSICAL">Physical</option><option value="DIGITAL">Digital</option></select></label>
        </div>
        <label><span>Description *</span><textarea rows={7} maxLength={5000} value={form.description} onChange={(event) => setField("description", event.target.value)} placeholder="What is it, who is it for, and what is included?" /></label>
        <label><span>Media URLs * · one per line</span><textarea rows={4} value={form.mediaUrls} onChange={(event) => setField("mediaUrls", event.target.value)} placeholder="https://…" /><small>Up to 10 image or video URLs.</small></label>

        <div className={styles.sectionTitle}><span>02</span><div><strong>Price & availability</strong><p>Set a stable offer state for later cart and order flows.</p></div></div>
        <label><span>Price (₦) *</span><input type="number" min="0" step="0.01" value={form.price} onChange={(event) => setField("price", event.target.value)} placeholder="25000" /></label>
        <label className={styles.check}><input type="checkbox" checked={form.trackInventory} onChange={(event) => setField("trackInventory", event.target.checked)} /> Track inventory</label>
        {form.trackInventory && <label><span>Stock quantity *</span><input type="number" min="0" value={form.inventoryQuantity} onChange={(event) => setField("inventoryQuantity", event.target.value)} placeholder="10" /></label>}
        <label><span>{form.type === "PHYSICAL" ? "Delivery information *" : "Delivery / access information"}</span><textarea rows={4} maxLength={1500} value={form.deliveryInformation} onChange={(event) => setField("deliveryInformation", event.target.value)} placeholder={form.type === "PHYSICAL" ? "Where you deliver, estimated delivery time, pickup options…" : "How the buyer receives or accesses the digital product…"} /></label>

        {error && <p className={styles.error}>{error}</p>}
        {notice && <p className={styles.notice}>{notice}</p>}
        <div className={styles.actions}>
          <button className={styles.secondary} type="submit" disabled={busy}>{busy ? "Working…" : "Save draft"}</button>
          {!published ? <button className={styles.primary} type="button" onClick={publish} disabled={busy}>Publish product ↗</button> : <button className={styles.secondary} type="button" onClick={pause} disabled={busy}>Pause product</button>}
          {currentId && !published && <button className={styles.dangerText} type="button" onClick={remove} disabled={busy}>Delete</button>}
        </div>
      </form>

      <aside className={styles.preview}>
        <p className={styles.previewLabel}>OFFER PREVIEW</p>
        <div className={styles.media} style={media[0] ? { backgroundImage: `url(${media[0]})` } : undefined}>{!media[0] && <span>Product media</span>}</div>
        <div className={styles.previewBody}>
          <span className={styles.badge}>{form.type}</span>
          <h2>{form.title || "Your product title"}</h2>
          <strong className={styles.price}>{product ? formatProductPrice({ ...product, priceMinor: toMinor(form.price) }) : form.price ? `₦${Number(form.price).toLocaleString("en-NG")}` : "Price not set"}</strong>
          <p>{form.description || "Your product description will appear here."}</p>
          <div className={styles.previewMeta}><span>{form.category || "Category"}</span><span>{form.trackInventory ? `${form.inventoryQuantity || 0} in stock` : "Available"}</span></div>
          {published && currentId && <a className={styles.publicLink} href={`/products/${currentId}`} target="_blank" rel="noreferrer">Open public product ↗</a>}
        </div>
      </aside>
    </section>

    <section className={styles.variants}>
      <div className={styles.sectionTitle}><span>03</span><div><strong>Variants</strong><p>Optional choices such as size, colour, format or edition.</p></div></div>
      {!currentId ? <p className={styles.muted}>Save the product draft first, then add variants.</p> : <>
        <div className={styles.addVariant}>
          <label><span>Variant name *</span><input value={variantName} onChange={(event) => setVariantName(event.target.value)} placeholder="Large / Black" /></label>
          <label><span>SKU</span><input value={variantSku} onChange={(event) => setVariantSku(event.target.value)} placeholder="TSHIRT-L-BLK" /></label>
          <label><span>Options</span><input value={variantOptions} onChange={(event) => setVariantOptions(event.target.value)} placeholder="Size=Large, Color=Black" /></label>
          <button type="button" onClick={addVariant} disabled={busy || !variantName.trim()}>Add variant</button>
        </div>
        <div className={styles.variantList}>{product?.variants.map((variant) => <VariantRow key={variant.id} productId={currentId} variant={variant} onChanged={refreshProduct} />)}</div>
        {product?.variants.length === 0 && <p className={styles.muted}>No variants yet. A product can also be sold without variants.</p>}
      </>}
    </section>
  </main>;
}
