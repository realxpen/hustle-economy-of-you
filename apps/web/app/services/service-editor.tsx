"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type {
  SaveServiceInput,
  Service,
  ServiceDeliveryMode,
  ServicePricingType
} from "@hustle/types";
import {
  createService,
  deleteService,
  formatServicePrice,
  getMyService,
  pauseService,
  publishService,
  saveService
} from "../../lib/service";
import styles from "./service-editor.module.css";

type FormState = {
  title: string;
  category: string;
  description: string;
  mediaUrls: string;
  priceNaira: string;
  pricingType: ServicePricingType;
  deliveryMode: ServiceDeliveryMode;
  location: string;
  availabilityNote: string;
  deliveryTime: string;
  requirements: string;
};

const emptyForm: FormState = {
  title: "",
  category: "",
  description: "",
  mediaUrls: "",
  priceNaira: "",
  pricingType: "FIXED",
  deliveryMode: "REMOTE",
  location: "",
  availabilityNote: "",
  deliveryTime: "",
  requirements: ""
};

function toForm(service: Service): FormState {
  return {
    title: service.title ?? "",
    category: service.category ?? "",
    description: service.description ?? "",
    mediaUrls: service.mediaUrls.join("\n"),
    priceNaira: service.priceMinor === null ? "" : String(service.priceMinor / 100),
    pricingType: service.pricingType,
    deliveryMode: service.deliveryMode,
    location: service.location ?? "",
    availabilityNote: service.availabilityNote ?? "",
    deliveryTime: service.deliveryTime ?? "",
    requirements: service.requirements ?? ""
  };
}

export function ServiceEditor({ serviceId }: { serviceId?: string }) {
  const [service, setService] = useState<Service | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(Boolean(serviceId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!serviceId) return;
    getMyService(serviceId)
      .then((next) => {
        setService(next);
        setForm(toForm(next));
      })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, [serviceId]);

  const requiredValues = useMemo(() => {
    const values = [
      form.title.trim(),
      form.category.trim(),
      form.description.trim(),
      form.priceNaira.trim(),
      form.availabilityNote.trim(),
      form.deliveryTime.trim()
    ];
    if (form.deliveryMode !== "REMOTE") values.push(form.location.trim());
    return values;
  }, [form]);
  const readiness = Math.round((requiredValues.filter(Boolean).length / requiredValues.length) * 100);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function buildInput(): SaveServiceInput {
    const price = form.priceNaira.trim() === "" ? null : Number(form.priceNaira);
    return {
      title: form.title,
      category: form.category,
      description: form.description,
      mediaUrls: form.mediaUrls.split("\n").map((item) => item.trim()).filter(Boolean),
      priceMinor: price === null || Number.isNaN(price) ? null : Math.round(price * 100),
      pricingType: form.pricingType,
      deliveryMode: form.deliveryMode,
      location: form.location,
      availabilityNote: form.availabilityNote,
      deliveryTime: form.deliveryTime,
      requirements: form.requirements
    };
  }

  async function persist() {
    const input = buildInput();
    if (service) {
      const updated = await saveService(service.id, input);
      setService(updated);
      return updated;
    }

    const created = await createService(input);
    setService(created);
    window.history.replaceState(null, "", `/services/${created.id}/edit`);
    return created;
  }

  async function save(event?: FormEvent) {
    event?.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await persist();
      setNotice("Service draft saved.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save this service");
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const saved = await persist();
      const published = await publishService(saved.id);
      setService(published);
      setNotice("Service published and publicly discoverable.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not publish this service");
    } finally {
      setBusy(false);
    }
  }

  async function pause() {
    if (!service) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const paused = await pauseService(service.id);
      setService(paused);
      setNotice("Service paused. Its public page is no longer available.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not pause this service");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!service) return;
    if (!window.confirm("Delete this service? This cannot be undone.")) return;
    setBusy(true);
    setError(null);
    try {
      await deleteService(service.id);
      window.location.assign("/services/manage");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not delete this service");
      setBusy(false);
    }
  }

  if (loading) {
    return <main className={styles.shell}><p className={styles.loading}>Loading service…</p></main>;
  }

  if (serviceId && !service && error) {
    return <main className={styles.shell}><section className={styles.errorCard}><h1>Service unavailable.</h1><p>{error}</p><a href="/services/manage">← Manage services</a></section></main>;
  }

  const status = service?.status ?? "DRAFT";
  const publicPrice = formatServicePrice({
    priceMinor: buildInput().priceMinor ?? null,
    currency: "NGN",
    pricingType: form.pricingType
  });

  return <main className={styles.shell}>
    <header className={styles.header}>
      <a href="/services/manage">← Services</a>
      <span>PHASE 5 · SERVICE OFFER</span>
    </header>

    <section className={styles.hero}>
      <div>
        <p className={styles.kicker}>HUSTLER · SERVICE</p>
        <h1>Turn capability into a <em>clear offer.</em></h1>
        <p>A service should tell a client exactly what you do, what it costs, where it happens and what to expect.</p>
      </div>
      <div className={styles.statusCard}><strong>{status}</strong><span>{readiness}% publish-ready</span></div>
    </section>

    <div className={styles.progress}><span style={{ width: `${readiness}%` }} /></div>

    <section className={styles.layout}>
      <form className={styles.form} onSubmit={save}>
        <div className={styles.sectionHeading}><span>01</span><div><strong>The offer</strong><p>Make the value understandable before the visitor has to ask questions.</p></div></div>

        <label><span>Service title *</span><input maxLength={120} value={form.title} onChange={(event) => setField("title", event.target.value)} placeholder="e.g. Professional Haircut" /></label>
        <label><span>Category *</span><input maxLength={100} value={form.category} onChange={(event) => setField("category", event.target.value)} placeholder="Beauty, Technology, Home Services…" /></label>
        <label><span>Description *</span><textarea rows={8} maxLength={3000} value={form.description} onChange={(event) => setField("description", event.target.value)} placeholder="Describe the outcome, what is included and who this service is for." /></label>

        <div className={styles.twoCol}>
          <label><span>Price in Naira *</span><input type="number" min="0" step="0.01" value={form.priceNaira} onChange={(event) => setField("priceNaira", event.target.value)} placeholder="8000" /></label>
          <label><span>Pricing type *</span><select value={form.pricingType} onChange={(event) => setField("pricingType", event.target.value as ServicePricingType)}><option value="FIXED">Fixed price</option><option value="STARTING_AT">Starting at</option><option value="HOURLY">Hourly</option></select></label>
        </div>

        <div className={styles.sectionHeading}><span>02</span><div><strong>Delivery</strong><p>Set expectations without building the later booking engine early.</p></div></div>

        <div className={styles.twoCol}>
          <label><span>Remote / physical *</span><select value={form.deliveryMode} onChange={(event) => setField("deliveryMode", event.target.value as ServiceDeliveryMode)}><option value="REMOTE">Remote</option><option value="PHYSICAL">Physical</option><option value="BOTH">Remote + physical</option></select></label>
          <label><span>Location {form.deliveryMode !== "REMOTE" ? "*" : ""}</span><input maxLength={160} value={form.location} onChange={(event) => setField("location", event.target.value)} placeholder="Lagos, Nigeria" /></label>
        </div>

        <div className={styles.twoCol}>
          <label><span>Availability *</span><input maxLength={500} value={form.availabilityNote} onChange={(event) => setField("availabilityNote", event.target.value)} placeholder="Mon–Sat, 9am–6pm" /></label>
          <label><span>Delivery time *</span><input maxLength={120} value={form.deliveryTime} onChange={(event) => setField("deliveryTime", event.target.value)} placeholder="Same day, 3 days, 2 weeks…" /></label>
        </div>

        <label><span>Client requirements</span><textarea rows={5} maxLength={1500} value={form.requirements} onChange={(event) => setField("requirements", event.target.value)} placeholder="What should the client provide before work starts?" /></label>

        <div className={styles.sectionHeading}><span>03</span><div><strong>Media</strong><p>Add up to 8 public image or video URLs. A dedicated upload pipeline can replace this thin MVP input later.</p></div></div>
        <label><span>Media URLs</span><textarea rows={5} value={form.mediaUrls} onChange={(event) => setField("mediaUrls", event.target.value)} placeholder={"https://…/photo.jpg\nhttps://…/demo.mp4"} /><small>One URL per line.</small></label>

        {error && <p className={styles.error}>{error}</p>}
        {notice && <p className={styles.notice}>{notice}</p>}

        <div className={styles.actions}>
          <button type="submit" className={styles.secondaryButton} disabled={busy}>{busy ? "Working…" : service?.status === "PUBLISHED" ? "Save changes" : "Save draft"}</button>
          {status !== "PUBLISHED" && <button type="button" className={styles.primaryButton} onClick={publish} disabled={busy || readiness < 100}>{status === "PAUSED" ? "Republish service ↗" : "Publish service ↗"}</button>}
          {status === "PUBLISHED" && <button type="button" className={styles.secondaryButton} onClick={pause} disabled={busy}>Pause service</button>}
          {service && status !== "PUBLISHED" && <button type="button" className={styles.dangerButton} onClick={remove} disabled={busy}>Delete</button>}
        </div>
      </form>

      <aside className={styles.preview}>
        <p className={styles.previewLabel}>SERVICE PREVIEW</p>
        <div className={styles.media} style={form.mediaUrls.split("\n").map((item) => item.trim()).filter(Boolean)[0] ? { backgroundImage: `url(${form.mediaUrls.split("\n").map((item) => item.trim()).filter(Boolean)[0]})` } : undefined} />
        <div className={styles.previewBody}>
          <span className={styles.category}>{form.category || "Category"}</span>
          <h2>{form.title || "Your service title"}</h2>
          <strong className={styles.price}>{publicPrice}</strong>
          <p>{form.description || "Describe the outcome your client is paying for."}</p>
          <div className={styles.meta}><span>{form.deliveryMode.replace("_", " + ")}</span><span>{form.deliveryTime || "Delivery time"}</span></div>
          <div className={styles.meta}><span>{form.location || "Remote"}</span><span>{form.availabilityNote || "Availability"}</span></div>
          {service?.status === "PUBLISHED" ? <a className={styles.publicLink} href={`/services/${service.id}`} target="_blank" rel="noreferrer">Open public service ↗</a> : <small>Publish to create the visitor-facing service page.</small>}
        </div>
      </aside>
    </section>
  </main>;
}
