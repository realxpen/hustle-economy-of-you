"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import type {
  HustlerProofType,
  SaveHustlerApplicationInput
} from "@hustle/types";

import {
  getAgentPrincipalOnboarding,
  removeAgentPrincipalHustlerProof,
  saveAgentPrincipalHustlerApplication,
  submitAgentPrincipalHustlerApplication,
  updateAgentPrincipalIdentity,
  uploadAgentPrincipalHustlerProof,
  type AgentPrincipalOnboardingView,
  type DelegatedHustlerProof
} from "../../../../../lib/agent-principal-onboarding";
import styles from "../../../../agents/page.module.css";

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

export default function AgentPrincipalOnboardingPage() {
  const params = useParams<{ principalUserId: string }>();
  const principalUserId = params.principalUserId;

  const [view, setView] = useState<AgentPrincipalOnboardingView | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [location, setLocation] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

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

  const scopes = useMemo(
    () => view?.permissions.filter((item) => item.active).map((item) => item.scope) ?? [],
    [view]
  );

  const canManageAccount = scopes.includes("ACCOUNT_ONBOARDING_MANAGE");
  const canManageApplication = scopes.includes("HUSTLER_APPLICATION_MANAGE");
  const isHustler = view?.principal.capabilities.some(
    (item) => item.capability === "HUSTLER" && item.status === "ACTIVE"
  ) ?? false;

  useEffect(() => {
    void load();
  }, [principalUserId]);

  function hydrate(next: AgentPrincipalOnboardingView) {
    setView(next);
    setDisplayName(next.principal.displayName ?? "");
    setUsername(next.principal.username ?? "");
    setLocation(next.principal.location ?? "");
    setBio(next.principal.bio ?? "");
    setAvatarUrl(next.principal.avatarUrl ?? "");

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
      hydrate(await getAgentPrincipalOnboarding(principalUserId));
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not load represented Client onboarding tools"
      );
    }
  }

  async function saveIdentity(event: FormEvent) {
    event.preventDefault();
    if (!canManageAccount) return;

    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      hydrate(await updateAgentPrincipalIdentity(principalUserId, {
        displayName,
        username,
        location: location || null,
        bio: bio || null,
        avatarUrl: avatarUrl || null
      }));
      setNotice("Client account details updated as a delegated Agent action.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update Client details");
    } finally {
      setBusy(false);
    }
  }

  async function saveApplication(event: FormEvent) {
    event.preventDefault();
    if (!canManageApplication) return;

    const input: SaveHustlerApplicationInput = {
      primarySkill,
      category,
      experienceSummary,
      yearsExperience: yearsExperience === "" ? null : Number(yearsExperience),
      businessName,
      businessInfo
    };

    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      hydrate(await saveAgentPrincipalHustlerApplication(principalUserId, input));
      setNotice("Hustler application draft saved for the Client.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save Hustler application");
    } finally {
      setBusy(false);
    }
  }

  async function attachProof(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !canManageApplication) return;
    if (!view?.principal.hustlerApplication) {
      setError("Save the Hustler application draft before attaching proof.");
      return;
    }

    setUploading(true);
    setError(null);
    setNotice(null);
    try {
      hydrate(
        await uploadAgentPrincipalHustlerProof(
          principalUserId,
          file,
          proofType
        )
      );
      setNotice("Private proof attached to the Client's Hustler application.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not attach proof");
    } finally {
      setUploading(false);
    }
  }

  async function removeProof(proof: DelegatedHustlerProof) {
    setUploading(true);
    setError(null);
    setNotice(null);
    try {
      hydrate(await removeAgentPrincipalHustlerProof(principalUserId, proof));
      setNotice("Proof removed.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not remove proof");
    } finally {
      setUploading(false);
    }
  }

  async function submitApplication() {
    if (!canManageApplication) return;

    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      hydrate(await submitAgentPrincipalHustlerApplication(principalUserId));
      setNotice(
        "Hustler application submitted for independent admin review. You cannot approve it."
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not submit Hustler application");
    } finally {
      setBusy(false);
    }
  }

  if (!view) {
    return <main className={styles.shell}>
      <p className={error ? styles.error : styles.loading}>
        {error ?? "Loading represented Client onboarding tools…"}
      </p>
    </main>;
  }

  const application = view.principal.hustlerApplication;
  const editableApplication =
    canManageApplication && !isHustler && (!application || application.status === "DRAFT");
  const proofs = application?.proofs ?? [];

  return <main className={styles.shell}>
    <header className={styles.topbar}>
      <a href="/agent-workspace">← Agent workspace</a>
      <span>DELEGATED CLIENT ONBOARDING</span>
    </header>

    <section className={styles.hero}>
      <div>
        <p className={styles.eyebrow}>CLIENT PRINCIPAL</p>
        <h1>{view.principal.displayName ?? view.principal.username ?? "Hustle user"}<br/><em>stays in control.</em></h1>
      </div>
      <p>
        These tools exist because this Client explicitly granted you onboarding or Hustler-application
        authority. The Client remains the account owner and every change records you as the Agent actor.
      </p>
    </section>

    {error && <p className={styles.error}>{error}</p>}
    {notice && <p className={styles.notice}>{notice}</p>}

    <section className={styles.boundary}>
      <strong>Login ownership is never delegated.</strong>
      <p>
        Account onboarding lets you maintain public/basic identity details only. You cannot change
        this Client&apos;s email, phone, password, authentication subject, wallet or reputation.
      </p>
    </section>

    <section className={styles.panelGrid}>
      <form className={styles.invitePanel} onSubmit={saveIdentity}>
        <p className={styles.panelLabel}>01 · ACCOUNT ONBOARDING</p>
        <h2>Basic Client identity.</h2>

        {!canManageAccount && <div className={styles.empty}>
          <strong>Account onboarding permission is not granted.</strong>
          <p>The Client can enable ACCOUNT_ONBOARDING_MANAGE from Manage Agents.</p>
        </div>}

        <label className={styles.field}>
          <span>Name</span>
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            disabled={!canManageAccount}
            required
          />
        </label>
        <label className={styles.field}>
          <span>Username</span>
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            disabled={!canManageAccount}
            required
          />
        </label>
        <label className={styles.field}>
          <span>Location</span>
          <input
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            disabled={!canManageAccount}
          />
        </label>
        <label className={styles.field}>
          <span>About</span>
          <textarea
            rows={4}
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            disabled={!canManageAccount}
          />
        </label>
        <label className={styles.field}>
          <span>Avatar URL</span>
          <input
            value={avatarUrl}
            onChange={(event) => setAvatarUrl(event.target.value)}
            disabled={!canManageAccount}
          />
        </label>

        {canManageAccount && <button className={styles.primary} disabled={busy} type="submit">
          {busy ? "Saving…" : "Save Client details"}
        </button>}
      </form>

      <div className={styles.relationshipPanel}>
        <form onSubmit={saveApplication} className={styles.card}>
          <p className={styles.panelLabel}>02 · HUSTLER APPLICATION</p>

          {!canManageApplication && <div className={styles.empty}>
            <strong>Hustler application permission is not granted.</strong>
            <p>The Client can enable HUSTLER_APPLICATION_MANAGE from Manage Agents.</p>
          </div>}

          {isHustler && <div className={styles.empty}>
            <strong>This Client already has ACTIVE HUSTLER capability.</strong>
            <p>Use the separate business workspace for professional profile, Services and Products.</p>
          </div>}

          <label className={styles.field}>
            <span>Primary skill</span>
            <input value={primarySkill} onChange={(event) => setPrimarySkill(event.target.value)} disabled={!editableApplication} required />
          </label>
          <label className={styles.field}>
            <span>Category</span>
            <select value={category} onChange={(event) => setCategory(event.target.value)} disabled={!editableApplication} required>
              <option value="">Choose a category</option>
              {categories.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className={styles.field}>
            <span>Experience summary</span>
            <textarea rows={5} maxLength={1200} value={experienceSummary} onChange={(event) => setExperienceSummary(event.target.value)} disabled={!editableApplication} required />
          </label>
          <label className={styles.field}>
            <span>Years of experience</span>
            <input type="number" min="0" max="80" value={yearsExperience} onChange={(event) => setYearsExperience(event.target.value)} disabled={!editableApplication} required />
          </label>
          <label className={styles.field}>
            <span>Business name — optional</span>
            <input value={businessName} onChange={(event) => setBusinessName(event.target.value)} disabled={!editableApplication} />
          </label>
          <label className={styles.field}>
            <span>Business info — optional</span>
            <textarea rows={3} value={businessInfo} onChange={(event) => setBusinessInfo(event.target.value)} disabled={!editableApplication} />
          </label>

          {editableApplication && <button className={styles.primary} disabled={busy} type="submit">
            {busy ? "Saving…" : application ? "Save application" : "Start Hustler application"}
          </button>}

          {application && <b className={styles.status}>{application.status.replaceAll("_", " ")}</b>}
        </form>

        <article className={styles.card}>
          <p className={styles.panelLabel}>03 · PRIVATE PROOF</p>

          {proofs.length === 0
            ? <div className={styles.empty}><strong>No proof attached yet.</strong></div>
            : <div className={styles.history}>
              {proofs.map((proof) => <div key={proof.id}>
                <span>{proof.fileName} · {proof.type.replaceAll("_", " ")}</span>
                {editableApplication && proof.agentCanRemove && <button
                  type="button"
                  className={styles.danger}
                  disabled={uploading}
                  onClick={() => void removeProof(proof)}
                >
                  Remove
                </button>}
              </div>)}
            </div>}

          {editableApplication && <>
            <label className={styles.field}>
              <span>Proof type</span>
              <select value={proofType} onChange={(event) => setProofType(event.target.value as HustlerProofType)}>
                {proofTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
            <label className={styles.secondary} style={{ display: "inline-block", cursor: "pointer" }}>
              {uploading ? "Uploading…" : "Attach proof"}
              <input
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                onChange={attachProof}
                disabled={uploading || !application}
                style={{ display: "none" }}
              />
            </label>
          </>}
        </article>

        <article className={styles.boundary}>
          <strong>04 · Submit for admin review</strong>
          <p>
            This permission lets you prepare and submit the application. It does not let you activate
            HUSTLER. An authorized Hustle admin independently verifies the applicant and makes the decision.
          </p>
          {editableApplication && <button
            className={styles.primary}
            type="button"
            disabled={busy || !application || proofs.length === 0}
            onClick={() => void submitApplication()}
          >
            Submit Hustler application
          </button>}
        </article>
      </div>
    </section>
  </main>;
}
