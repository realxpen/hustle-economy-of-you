"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import type {
  AgentApplication,
  AgentApplicationProof,
  AgentProofType,
  HustleAccount
} from "@hustle/types";
import {
  getMyAgentApplication,
  removeMyAgentProof,
  saveMyAgentApplication,
  submitMyAgentApplication,
  uploadMyAgentProof
} from "../../lib/agent-application";
import { getMyAccount } from "../../lib/auth/hustle-account";
import styles from "../hustler-application/page.module.css";

type FormState = {
  motivation: string;
  experienceSummary: string;
  operatingArea: string;
  organizationName: string;
  organizationInfo: string;
};

const emptyForm: FormState = {
  motivation: "",
  experienceSummary: "",
  operatingArea: "",
  organizationName: "",
  organizationInfo: ""
};

const proofTypes: { value: AgentProofType; label: string }[] = [
  { value: "IDENTITY_DOCUMENT", label: "Identity document" },
  { value: "BUSINESS_DOCUMENT", label: "Business / organization document" },
  { value: "COMMUNITY_REFERENCE", label: "Community reference" },
  { value: "OTHER", label: "Other supporting proof" }
];

function toForm(application: AgentApplication | null): FormState {
  if (!application) return emptyForm;
  return {
    motivation: application.motivation ?? "",
    experienceSummary: application.experienceSummary ?? "",
    operatingArea: application.operatingArea ?? "",
    organizationName: application.organizationName ?? "",
    organizationInfo: application.organizationInfo ?? ""
  };
}

export default function AgentApplicationPage() {
  const [account, setAccount] = useState<HustleAccount | null>(null);
  const [application, setApplication] = useState<AgentApplication | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [proofType, setProofType] = useState<AgentProofType>("IDENTITY_DOCUMENT");
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
        const [nextAccount, nextApplication] = await Promise.all([
          getMyAccount(),
          getMyAgentApplication()
        ]);
        if (!active) return;
        setAccount(nextAccount);
        setApplication(nextApplication);
        setForm(toForm(nextApplication));
      } catch (reason) {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : "Could not load your Agent application");
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => { active = false; };
  }, []);

  const isAgent = account?.capabilities.some(
    (item) => item.capability === "AGENT" && item.status === "ACTIVE"
  ) ?? false;
  const editable = !application || application.status === "DRAFT";
  const proofCount = application?.proofs.length ?? 0;

  const completedCoreFields = useMemo(() => [
    form.motivation.trim(),
    form.experienceSummary.trim(),
    form.operatingArea.trim()
  ].filter(Boolean).length, [form]);

  const progress = Math.round(((completedCoreFields + (proofCount > 0 ? 1 : 0)) / 4) * 100);
  const canSubmit = editable && completedCoreFields === 3 && proofCount > 0;

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function saveDraft(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      const saved = await saveMyAgentApplication({
        motivation: form.motivation,
        experienceSummary: form.experienceSummary,
        operatingArea: form.operatingArea,
        organizationName: form.organizationName,
        organizationInfo: form.organizationInfo
      });
      setApplication(saved);
      setNotice("Draft saved to your existing Hustle identity.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save your Agent application");
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
      const updated = await uploadMyAgentProof(file, proofType);
      setApplication(updated);
      setNotice("Proof attached privately to your Agent application.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not attach proof");
    } finally {
      setUploading(false);
    }
  }

  async function removeProof(proof: AgentApplicationProof) {
    setUploading(true);
    setError(null);
    try {
      const updated = await removeMyAgentProof(proof);
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
      const submitted = await submitMyAgentApplication();
      setApplication(submitted);
      setNotice("Agent application submitted. Admin review is now pending.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not submit your Agent application");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <main className={styles.shell}><p className={styles.loading}>Loading your Agent application…</p></main>;
  }

  if (error && !account) {
    return <main className={styles.shell}><div className={styles.centerCard}><p>{error}</p><a href="/auth">Return to sign in →</a></div></main>;
  }

  if (isAgent) {
    return <main className={styles.shell}>
      <header className={styles.header}><a href="/account" className={styles.back}>← Your identity</a><span>PHASE 18A · CAPABILITY</span></header>
      <section className={styles.unlocked}>
        <p>AGENT · ACTIVE</p>
        <h1>You can <em>represent.</em></h1>
        <p>
          Agent is active on this same Hustle identity. This approval does not give you ownership of another Hustler&apos;s identity, business, funds, reviews or reputation. Delegated access will require an explicit Hustler relationship and permission grant.
        </p>
        <a href="/account">Back to your Hustle identity →</a>
      </section>
    </main>;
  }

  return <main className={styles.shell}>
    <header className={styles.header}>
      <a href="/account" className={styles.back}>← Your identity</a>
      <span>PHASE 18A · AGENT APPLICATION</span>
    </header>

    <section className={styles.hero}>
      <div>
        <p className={styles.eyebrow}>PROGRESSIVE CAPABILITY</p>
        <h1>Help skilled people become <em>discoverable.</em></h1>
      </div>
      <div className={styles.heroMeta}>
        <strong>{application?.status ?? "NOT STARTED"}</strong>
        <span>{progress}% application ready</span>
      </div>
    </section>

    <div className={styles.progressTrack}><span style={{ width: `${progress}%` }} /></div>

    <section className={styles.layout}>
      <form className={styles.form} onSubmit={saveDraft}>
        <div className={styles.sectionTitle}><span>01</span><div><strong>Why Agent?</strong><p>Explain who you want to help and why you can represent professionals responsibly.</p></div></div>

        <div className={styles.twoCol}>
          <label className={styles.spanTwo}><span>Motivation *</span><textarea value={form.motivation} onChange={(event) => setField("motivation", event.target.value)} placeholder="Why do you want to become a Hustle Agent, and who do you expect to help?" rows={5} disabled={!editable} maxLength={1200} /></label>
          <label className={styles.spanTwo}><span>Relevant experience *</span><textarea value={form.experienceSummary} onChange={(event) => setField("experienceSummary", event.target.value)} placeholder="Community work, business support, customer management, digital assistance, or similar experience." rows={5} disabled={!editable} maxLength={1200} /></label>
          <label><span>Operating area *</span><input value={form.operatingArea} onChange={(event) => setField("operatingArea", event.target.value)} placeholder="e.g. Yaba, Lagos" disabled={!editable} maxLength={160} /></label>
        </div>

        <div className={styles.sectionTitle}><span>02</span><div><strong>Organization context</strong><p>Optional. Use this if you operate through a business, agency, NGO, community group or team.</p></div></div>

        <div className={styles.twoCol}>
          <label><span>Organization name</span><input value={form.organizationName} onChange={(event) => setField("organizationName", event.target.value)} placeholder="Optional" disabled={!editable} maxLength={160} /></label>
          <label className={styles.spanTwo}><span>Organization information</span><textarea value={form.organizationInfo} onChange={(event) => setField("organizationInfo", event.target.value)} placeholder="Describe the organization or the way you expect to support professionals." rows={4} disabled={!editable} maxLength={800} /></label>
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
          <div className={styles.sectionTitle}><span>03</span><div><strong>Agent proof</strong><p>At least one private proof item is required before admin review.</p></div></div>

          {proofCount > 0 ? <div className={styles.proofList}>{application?.proofs.map((proof) => <div key={proof.id}><div><strong>{proof.fileName}</strong><span>{proof.type.replaceAll("_", " ")}</span></div>{editable && <button type="button" onClick={() => removeProof(proof)} disabled={uploading}>Remove</button>}</div>)}</div> : <div className={styles.emptyProof}><span>0</span><p>No Agent proof attached yet.</p></div>}

          {editable && <div className={styles.uploadPanel}>
            <label><span>Proof type</span><select value={proofType} onChange={(event) => setProofType(event.target.value as AgentProofType)} disabled={uploading}>{proofTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
            <label className={`${styles.uploadButton} ${!application ? styles.uploadDisabled : ""}`}>
              <span>{uploading ? "Uploading…" : application ? "Attach proof" : "Save draft first"}</span>
              <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={attachProof} disabled={!application || uploading} />
            </label>
            <small>Private · PDF/JPEG/PNG/WebP · max 10 MB</small>
          </div>}
        </article>

        <article className={styles.reviewCard}>
          <p>04 · ADMIN REVIEW</p>
          <h2>Capability before delegation.</h2>
          <p>
            Approval only adds AGENT to this identity. It does not grant access to any Hustler. Every future relationship must be explicit and permissioned by the Hustler.
          </p>
          <button type="button" onClick={submitForReview} disabled={!canSubmit || busy} className={styles.submitButton}>{application?.status === "DRAFT" || !application ? "Submit for review" : application.status.replaceAll("_", " ")}</button>
          {!canSubmit && editable && <small>Complete the three required fields and attach at least one proof item.</small>}
        </article>
      </aside>
    </section>
  </main>;
}
