"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import type {
  HustleAccount,
  HustlerApplication,
  HustlerApplicationProof,
  HustlerProofType
} from "@hustle/types";
import { getMyAccount } from "../../lib/auth/hustle-account";
import {
  getMyHustlerApplication,
  removeMyHustlerProof,
  saveMyHustlerApplication,
  submitMyHustlerApplication,
  uploadMyHustlerProof
} from "../../lib/hustler-application";
import styles from "./page.module.css";

type FormState = {
  primarySkill: string;
  category: string;
  experienceSummary: string;
  yearsExperience: string;
  businessName: string;
  businessInfo: string;
};

const emptyForm: FormState = {
  primarySkill: "",
  category: "",
  experienceSummary: "",
  yearsExperience: "",
  businessName: "",
  businessInfo: ""
};

const categories = [
  "Technology",
  "Design & Creative",
  "Beauty & Lifestyle",
  "Home & Repairs",
  "Business & Professional",
  "Media & Entertainment",
  "Education & Training",
  "Food & Hospitality",
  "Fashion",
  "Other"
];

const proofTypes: { value: HustlerProofType; label: string }[] = [
  { value: "PORTFOLIO", label: "Portfolio work" },
  { value: "CERTIFICATE", label: "Certificate" },
  { value: "BUSINESS_DOCUMENT", label: "Business document" },
  { value: "IDENTITY_DOCUMENT", label: "Identity document" },
  { value: "OTHER", label: "Other supporting proof" }
];

function toForm(application: HustlerApplication | null): FormState {
  if (!application) return emptyForm;
  return {
    primarySkill: application.primarySkill ?? "",
    category: application.category ?? "",
    experienceSummary: application.experienceSummary ?? "",
    yearsExperience: application.yearsExperience === null ? "" : String(application.yearsExperience),
    businessName: application.businessName ?? "",
    businessInfo: application.businessInfo ?? ""
  };
}

export default function HustlerApplicationPage() {
  const [account, setAccount] = useState<HustleAccount | null>(null);
  const [application, setApplication] = useState<HustlerApplication | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [proofType, setProofType] = useState<HustlerProofType>("PORTFOLIO");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const nextAccount = await getMyAccount();
        if (!active) return;
        setAccount(nextAccount);
      } catch (reason) {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : "Could not load your Hustle identity");
        setLoading(false);
        return;
      }

      try {
        const nextApplication = await getMyHustlerApplication();
        if (!active) return;
        setApplication(nextApplication);
        setForm(toForm(nextApplication));
      } catch (reason) {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : "Could not load your Hustler application");
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => { active = false; };
  }, []);

  const isHustler = account?.capabilities.some(
    (item) => item.capability === "HUSTLER" && item.status === "ACTIVE"
  ) ?? false;
  const editable = !application || application.status === "DRAFT";
  const proofCount = application?.proofs.length ?? 0;

  const completedCoreFields = useMemo(() => [
    form.primarySkill.trim(),
    form.category.trim(),
    form.experienceSummary.trim(),
    form.yearsExperience.trim()
  ].filter(Boolean).length, [form]);

  const progress = Math.round(((completedCoreFields + (proofCount > 0 ? 1 : 0)) / 5) * 100);
  const canSubmit = editable && completedCoreFields === 4 && proofCount > 0;

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function saveDraft(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      const saved = await saveMyHustlerApplication({
        primarySkill: form.primarySkill,
        category: form.category,
        experienceSummary: form.experienceSummary,
        yearsExperience: form.yearsExperience === "" ? null : Number(form.yearsExperience),
        businessName: form.businessName,
        businessInfo: form.businessInfo
      });
      setApplication(saved);
      setNotice("Draft saved to your Hustle identity.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save your application");
    } finally {
      setBusy(false);
    }
  }

  async function attachProof(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!application) {
      setError("Save your application draft before attaching proof.");
      return;
    }

    setUploading(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await uploadMyHustlerProof(file, proofType);
      setApplication(updated);
      setNotice("Proof attached privately to your application.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not attach proof");
    } finally {
      setUploading(false);
    }
  }

  async function removeProof(proof: HustlerApplicationProof) {
    setUploading(true);
    setError(null);
    try {
      const updated = await removeMyHustlerProof(proof);
      setApplication(updated);
      setNotice("Proof removed.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not remove proof");
    } finally {
      setUploading(false);
    }
  }

  async function submitForReview() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const submitted = await submitMyHustlerApplication();
      setApplication(submitted);
      setNotice("Application submitted. Hustle review is now pending.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not submit your application");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <main className={styles.shell}><p className={styles.loading}>Loading your application…</p></main>;
  }

  if (error && !account) {
    return <main className={styles.shell}><div className={styles.centerCard}><p>{error}</p><a href="/auth">Return to sign in →</a></div></main>;
  }

  if (isHustler) {
    return <main className={styles.shell}>
      <header className={styles.header}><a href="/account" className={styles.back}>← Your identity</a><span>PHASE 3 · CAPABILITY</span></header>
      <section className={styles.unlocked}>
        <p>HUSTLER · ACTIVE</p>
        <h1>You can <em>hustle.</em></h1>
        <p>This identity already has the Hustler capability. Client access remains active on the same account.</p>
        <a href="/account">Back to your Hustle identity →</a>
      </section>
    </main>;
  }

  return <main className={styles.shell}>
    <header className={styles.header}>
      <a href="/account" className={styles.back}>← Your identity</a>
      <span>PHASE 3 · HUSTLER APPLICATION</span>
    </header>

    <section className={styles.hero}>
      <div>
        <p className={styles.eyebrow}>PROGRESSIVE CAPABILITY</p>
        <h1>Turn what you can do into <em>proof.</em></h1>
      </div>
      <div className={styles.heroMeta}>
        <strong>{application?.status ?? "NOT STARTED"}</strong>
        <span>{progress}% application ready</span>
      </div>
    </section>

    <div className={styles.progressTrack}><span style={{ width: `${progress}%` }} /></div>

    <section className={styles.layout}>
      <form className={styles.form} onSubmit={saveDraft}>
        <div className={styles.sectionTitle}><span>01</span><div><strong>Your capability</strong><p>Tell Hustle what people should discover you for.</p></div></div>

        <div className={styles.twoCol}>
          <label><span>Primary skill *</span><input value={form.primarySkill} onChange={(event) => setField("primarySkill", event.target.value)} placeholder="e.g. Frontend development" disabled={!editable} /></label>
          <label><span>Category *</span><select value={form.category} onChange={(event) => setField("category", event.target.value)} disabled={!editable}><option value="">Choose a category</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
        </div>

        <div className={styles.twoCol}>
          <label className={styles.spanTwo}><span>Experience summary *</span><textarea value={form.experienceSummary} onChange={(event) => setField("experienceSummary", event.target.value)} placeholder="What have you done, who have you helped, and what outcomes can you point to?" rows={6} disabled={!editable} maxLength={1200} /></label>
          <label><span>Years of experience *</span><input type="number" min="0" max="80" value={form.yearsExperience} onChange={(event) => setField("yearsExperience", event.target.value)} placeholder="0" disabled={!editable} /></label>
        </div>

        <div className={styles.sectionTitle}><span>02</span><div><strong>Business context</strong><p>Optional. Useful if you already operate under a business or studio name.</p></div></div>

        <div className={styles.twoCol}>
          <label><span>Business name</span><input value={form.businessName} onChange={(event) => setField("businessName", event.target.value)} placeholder="Optional" disabled={!editable} /></label>
          <label className={styles.spanTwo}><span>Business information</span><textarea value={form.businessInfo} onChange={(event) => setField("businessInfo", event.target.value)} placeholder="Describe the business, team or way you work." rows={4} disabled={!editable} maxLength={800} /></label>
        </div>

        {error && <p className={styles.error}>{error}</p>}
        {notice && <p className={styles.notice}>{notice}</p>}

        <div className={styles.actions}>
          {editable ? <button type="submit" className={styles.saveButton} disabled={busy}>{busy ? "Saving…" : application ? "Save draft" : "Start application"}</button> : <span className={styles.locked}>Editing locked · {application?.status}</span>}
          <a href="/account">Save and leave</a>
        </div>
      </form>

      <aside className={styles.side}>
        <article className={styles.proofCard}>
          <div className={styles.sectionTitle}><span>03</span><div><strong>Capability proof</strong><p>At least one private proof item is required before review.</p></div></div>

          {proofCount > 0 ? <div className={styles.proofList}>{application?.proofs.map((proof) => <div key={proof.id}><div><strong>{proof.fileName}</strong><span>{proof.type.replaceAll("_", " ")}</span></div>{editable && <button type="button" onClick={() => removeProof(proof)} disabled={uploading}>Remove</button>}</div>)}</div> : <div className={styles.emptyProof}><span>0</span><p>No proof attached yet.</p></div>}

          {editable && <div className={styles.uploadPanel}>
            <label><span>Proof type</span><select value={proofType} onChange={(event) => setProofType(event.target.value as HustlerProofType)} disabled={uploading}>{proofTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
            <label className={`${styles.uploadButton} ${!application ? styles.uploadDisabled : ""}`}>
              <span>{uploading ? "Uploading…" : application ? "Attach proof" : "Save draft first"}</span>
              <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={attachProof} disabled={!application || uploading} />
            </label>
            <small>Private · PDF/JPEG/PNG/WebP · max 10 MB</small>
          </div>}
        </article>

        <article className={styles.reviewCard}>
          <p>04 · REVIEW</p>
          <h2>Trust before access.</h2>
          <p>Hustler is added to this same identity only after review. CLIENT is never removed and there is no role switcher.</p>
          <button type="button" onClick={submitForReview} disabled={!canSubmit || busy} className={styles.submitButton}>{application?.status === "DRAFT" || !application ? "Submit for review" : application.status.replaceAll("_", " ")}</button>
          {!canSubmit && editable && <small>Complete the four required fields and attach at least one proof item.</small>}
        </article>
      </aside>
    </section>
  </main>;
}
