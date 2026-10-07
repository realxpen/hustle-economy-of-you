"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type {
  AgentAssistedRegistration,
  HustlerProofType,
  SaveHustlerApplicationInput
} from "@hustle/types";

import {
  getAssistedRegistration,
  removeAssistedHustlerProof,
  saveAssistedHustlerApplication,
  submitAssistedHustlerApplication,
  updateAssistedIdentity,
  uploadAssistedHustlerProof
} from "../../../../lib/agent-assisted-onboarding";
import styles from "../../../agents/page.module.css";

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

export default function AssistedRegistrationDetailPage() {
  const params = useParams<{ registrationId: string }>();
  const registrationId = params.registrationId;

  const [registration, setRegistration] = useState<AgentAssistedRegistration | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [location, setLocation] = useState("");
  const [bio, setBio] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [primarySkill, setPrimarySkill] = useState("");
  const [category, setCategory] = useState("");
  const [experienceSummary, setExperienceSummary] = useState("");
  const [yearsExperience, setYearsExperience] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [businessInfo, setBusinessInfo] = useState("");

  const [proofType, setProofType] = useState<HustlerProofType>("PORTFOLIO");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, [registrationId]);

  function hydrate(next: AgentAssistedRegistration) {
    setRegistration(next);
    setDisplayName(next.principal.displayName ?? "");
    setUsername(next.principal.username ?? "");
    setLocation(next.principal.location ?? "");
    setBio(next.principal.bio ?? "");
    setEmail(next.principal.email ?? "");
    setPhone(next.principal.phone ?? "");

    const application = next.principal.hustlerApplication;
    setPrimarySkill(application?.primarySkill ?? "");
    setCategory(application?.category ?? "");
    setExperienceSummary(application?.experienceSummary ?? "");
    setYearsExperience(
      application?.yearsExperience === null || application?.yearsExperience === undefined
        ? ""
        : String(application.yearsExperience)
    );
    setBusinessName(application?.businessName ?? "");
    setBusinessInfo(application?.businessInfo ?? "");
  }

  async function load() {
    setError(null);
    try {
      hydrate(await getAssistedRegistration(registrationId));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load assisted identity");
    }
  }

  async function saveIdentity(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const next = await updateAssistedIdentity(registrationId, {
        displayName,
        username,
        location: location || null,
        bio: bio || null,
        email: email || null,
        phone: phone || null
      });
      hydrate(next);
      setNotice("Assisted Client identity updated.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update identity");
    } finally {
      setBusy(false);
    }
  }

  async function saveApplication(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    const input: SaveHustlerApplicationInput = {
      primarySkill,
      category,
      experienceSummary,
      yearsExperience: yearsExperience === "" ? null : Number(yearsExperience),
      businessName,
      businessInfo
    };
    try {
      const next = await saveAssistedHustlerApplication(registrationId, input);
      hydrate(next);
      setNotice("Hustler application draft saved for the account owner.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save Hustler application");
    } finally {
      setBusy(false);
    }
  }

  async function attachProof(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !registration) return;
    if (!registration.principal.hustlerApplication) {
      setError("Save the Hustler application draft before attaching proof.");
      return;
    }

    setUploading(true);
    setError(null);
    setNotice(null);
    try {
      const next = await uploadAssistedHustlerProof(registration, file, proofType);
      hydrate(next);
      setNotice("Private proof attached to the account owner's application.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not attach proof");
    } finally {
      setUploading(false);
    }
  }

  async function removeProof(proofId: string, storageKey: string) {
    if (!registration) return;
    setUploading(true);
    setError(null);
    try {
      const next = await removeAssistedHustlerProof(registration, proofId, storageKey);
      hydrate(next);
      setNotice("Proof removed.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not remove proof");
    } finally {
      setUploading(false);
    }
  }

  async function submitApplication() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const next = await submitAssistedHustlerApplication(registrationId);
      hydrate(next);
      setNotice("Hustler application submitted for admin review.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not submit Hustler application");
    } finally {
      setBusy(false);
    }
  }

  if (!registration) {
    return <main className={styles.shell}>
      <p className={error ? styles.error : styles.loading}>{error ?? "Loading assisted identity…"}</p>
    </main>;
  }

  const application = registration.principal.hustlerApplication;
  const editableApplication = !application || application.status === "DRAFT";
  const editableIdentity = registration.status === "ACTIVE";
  const proofs = application?.proofs ?? [];

  return <main className={styles.shell}>
    <header className={styles.topbar}>
      <a href="/agent-workspace/onboarding">← Assisted onboarding</a>
      <span>{registration.status} · @{registration.principal.username}</span>
    </header>

    <section className={styles.hero}>
      <div>
        <p className={styles.eyebrow}>ACCOUNT OWNER</p>
        <h1>{registration.principal.displayName ?? "Hustle user"}<br/><em>stays the owner.</em></h1>
      </div>
      <p>
        You are the recorded Agent actor. This identity can later be claimed by the person
        through their verified email or phone without losing this application or relationship history.
      </p>
    </section>

    {error && <p className={styles.error}>{error}</p>}
    {notice && <p className={styles.notice}>{notice}</p>}

    <section className={styles.panelGrid}>
      <form className={styles.invitePanel} onSubmit={saveIdentity}>
        <p className={styles.panelLabel}>01 · ASSISTED CLIENT IDENTITY</p>
        <h2>Keep their details accurate.</h2>
        <label className={styles.field}><span>Name</span><input value={displayName} onChange={(e) => setDisplayName(e.target.value)} disabled={!editableIdentity} required /></label>
        <label className={styles.field}><span>Username</span><input value={username} onChange={(e) => setUsername(e.target.value)} disabled={!editableIdentity} required /></label>
        <label className={styles.field}><span>Location</span><input value={location} onChange={(e) => setLocation(e.target.value)} disabled={!editableIdentity} /></label>
        <label className={styles.field}><span>About</span><input value={bio} onChange={(e) => setBio(e.target.value)} disabled={!editableIdentity} /></label>
        <label className={styles.field}><span>Email — optional claim contact</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!editableIdentity} /></label>
        <label className={styles.field}><span>Phone — optional claim contact</span><input value={phone} onChange={(e) => setPhone(e.target.value)} disabled={!editableIdentity} /></label>
        {editableIdentity
          ? <button className={styles.primary} disabled={busy} type="submit">{busy ? "Saving…" : "Save identity"}</button>
          : <small>This identity has been claimed. Continue only through delegated permission surfaces.</small>}
      </form>

      <div className={styles.relationshipPanel}>
        <form onSubmit={saveApplication} className={styles.card}>
          <p className={styles.panelLabel}>02 · HUSTLER APPLICATION</p>
          <label className={styles.field}><span>Primary skill</span><input value={primarySkill} onChange={(e) => setPrimarySkill(e.target.value)} disabled={!editableApplication} required /></label>
          <label className={styles.field}><span>Category</span><select value={category} onChange={(e) => setCategory(e.target.value)} disabled={!editableApplication} required><option value="">Choose a category</option>{categories.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className={styles.field}><span>Experience summary</span><textarea rows={5} maxLength={1200} value={experienceSummary} onChange={(e) => setExperienceSummary(e.target.value)} disabled={!editableApplication} required /></label>
          <label className={styles.field}><span>Years of experience</span><input type="number" min="0" max="80" value={yearsExperience} onChange={(e) => setYearsExperience(e.target.value)} disabled={!editableApplication} required /></label>
          <label className={styles.field}><span>Business name — optional</span><input value={businessName} onChange={(e) => setBusinessName(e.target.value)} disabled={!editableApplication} /></label>
          <label className={styles.field}><span>Business info — optional</span><textarea rows={3} value={businessInfo} onChange={(e) => setBusinessInfo(e.target.value)} disabled={!editableApplication} /></label>
          {editableApplication && <button className={styles.primary} disabled={busy} type="submit">{busy ? "Saving…" : application ? "Save application" : "Start Hustler application"}</button>}
          {application && <b className={styles.status}>{application.status.replaceAll("_", " ")}</b>}
        </form>

        <article className={styles.card}>
          <p className={styles.panelLabel}>03 · PRIVATE PROOF</p>
          {proofs.length === 0 ? <div className={styles.empty}><strong>No proof attached yet.</strong></div> : <div className={styles.history}>
            {proofs.map((proof) => <div key={proof.id}>
              <span>{proof.fileName} · {proof.type.replaceAll("_", " ")}</span>
              {editableApplication && <button type="button" className={styles.danger} disabled={uploading} onClick={() => removeProof(proof.id, proof.storageKey)}>Remove</button>}
            </div>)}
          </div>}

          {editableApplication && <>
            <label className={styles.field}><span>Proof type</span><select value={proofType} onChange={(e) => setProofType(e.target.value as HustlerProofType)}>{proofTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
            <label className={styles.secondary} style={{ display: "inline-block", cursor: "pointer" }}>
              {uploading ? "Uploading…" : "Attach proof"}
              <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={attachProof} disabled={uploading || !application} style={{ display: "none" }} />
            </label>
          </>}
        </article>

        <article className={styles.boundary}>
          <strong>04 · Submit for admin review</strong>
          <p>
            Submission does not activate Hustler automatically. An authorized Hustle admin still
            reviews the person, verifies identity/proof, and decides whether to activate HUSTLER.
          </p>
          {editableApplication && <button className={styles.primary} type="button" disabled={busy || !application || proofs.length === 0} onClick={submitApplication}>Submit Hustler application</button>}
        </article>
      </div>
    </section>
  </main>;
}
