"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { HustleAccount, ProfessionalProfile } from "@hustle/types";
import { getMyAccount } from "../../lib/auth/hustle-account";
import {
  getMyProfessionalProfile,
  publishMyProfessionalProfile,
  saveMyProfessionalProfile,
  unpublishMyProfessionalProfile
} from "../../lib/professional-profile";
import styles from "./page.module.css";

type FormState = {
  headline: string;
  coverUrl: string;
  primarySkill: string;
  secondarySkills: string;
  category: string;
  professionalSummary: string;
  yearsExperience: string;
};

const emptyForm: FormState = {
  headline: "",
  coverUrl: "",
  primarySkill: "",
  secondarySkills: "",
  category: "",
  professionalSummary: "",
  yearsExperience: ""
};

function toForm(profile: ProfessionalProfile): FormState {
  return {
    headline: profile.headline ?? "",
    coverUrl: profile.coverUrl ?? "",
    primarySkill: profile.primarySkill ?? "",
    secondarySkills: profile.secondarySkills.join(", "),
    category: profile.category ?? "",
    professionalSummary: profile.professionalSummary ?? "",
    yearsExperience:
      profile.yearsExperience === null ? "" : String(profile.yearsExperience)
  };
}

export default function ProfessionalProfilePage() {
  const [account, setAccount] = useState<HustleAccount | null>(null);
  const [profile, setProfile] = useState<ProfessionalProfile | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getMyAccount(), getMyProfessionalProfile()])
      .then(([nextAccount, nextProfile]) => {
        setAccount(nextAccount);
        setProfile(nextProfile);
        setForm(toForm(nextProfile));
      })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, []);

  const completedFields = useMemo(() => [
    form.headline.trim(),
    form.primarySkill.trim(),
    form.category.trim(),
    form.professionalSummary.trim(),
    form.yearsExperience.trim()
  ].filter(Boolean).length, [form]);

  const readiness = Math.round((completedFields / 5) * 100);
  const published = profile?.status === "PUBLISHED";
  const initial = (account?.displayName ?? account?.username ?? "H").charAt(0).toUpperCase();

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function buildInput() {
    return {
      headline: form.headline,
      coverUrl: form.coverUrl,
      primarySkill: form.primarySkill,
      secondarySkills: form.secondarySkills
        .split(",")
        .map((skill) => skill.trim())
        .filter(Boolean),
      category: form.category,
      professionalSummary: form.professionalSummary,
      yearsExperience:
        form.yearsExperience === "" ? null : Number(form.yearsExperience)
    };
  }

  async function save(event?: FormEvent) {
    event?.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const saved = await saveMyProfessionalProfile(buildInput());
      setProfile(saved);
      setNotice("Professional identity saved.");
      return saved;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save your profile");
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
      await saveMyProfessionalProfile(buildInput());
      const next = await publishMyProfessionalProfile();
      setProfile(next);
      setNotice("Your professional profile is now public.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not publish your profile");
    } finally {
      setBusy(false);
    }
  }

  async function unpublish() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const next = await unpublishMyProfessionalProfile();
      setProfile(next);
      setNotice("Profile returned to draft. Your Hustler capability is still active.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not unpublish your profile");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <main className={styles.shell}><p className={styles.loading}>Building your professional identity…</p></main>;
  }

  if (!account || !profile) {
    return <main className={styles.shell}><section className={styles.errorCard}><h1>Professional profile unavailable.</h1><p>{error ?? "HUSTLER ACTIVE is required."}</p><a href="/account">← Back to your identity</a></section></main>;
  }

  return <main className={styles.shell}>
    <header className={styles.header}>
      <a href="/account">← Your identity</a>
      <span>PHASE 4 · PROFESSIONAL IDENTITY</span>
    </header>

    <section className={styles.hero}>
      <div className={styles.avatar}>{account.avatarUrl ? <img src={account.avatarUrl} alt="" /> : initial}</div>
      <div className={styles.heroCopy}>
        <p>HUSTLER · ACTIVE</p>
        <h1>Make your capability <em>legible.</em></h1>
        <span>@{account.username ?? "username required"} · {account.location ?? "Location not set"}</span>
      </div>
      <div className={styles.statusBlock}>
        <strong>{profile.status}</strong>
        <span>{readiness}% ready</span>
      </div>
    </section>

    <div className={styles.progress}><span style={{ width: `${readiness}%` }} /></div>

    <section className={styles.layout}>
      <form className={styles.form} onSubmit={save}>
        <div className={styles.sectionHeading}><span>01</span><div><strong>Positioning</strong><p>Say clearly what people should understand about your capability.</p></div></div>

        <label><span>Professional headline *</span><input value={form.headline} maxLength={160} onChange={(event) => setField("headline", event.target.value)} placeholder="e.g. Product-minded full-stack engineer building reliable digital products" /></label>

        <div className={styles.twoCol}>
          <label><span>Primary skill *</span><input value={form.primarySkill} maxLength={100} onChange={(event) => setField("primarySkill", event.target.value)} /></label>
          <label><span>Professional category *</span><input value={form.category} maxLength={100} onChange={(event) => setField("category", event.target.value)} placeholder="Technology" /></label>
        </div>

        <label><span>Supporting skills</span><input value={form.secondarySkills} onChange={(event) => setField("secondarySkills", event.target.value)} placeholder="React, TypeScript, Product design — separate with commas" /><small>Up to 12 skills.</small></label>

        <div className={styles.sectionHeading}><span>02</span><div><strong>Professional story</strong><p>Give visitors enough context to understand the work behind the headline.</p></div></div>

        <label><span>Professional summary *</span><textarea rows={8} maxLength={1800} value={form.professionalSummary} onChange={(event) => setField("professionalSummary", event.target.value)} placeholder="What do you do, how do you work, and what kind of outcomes can people expect?" /></label>

        <div className={styles.twoCol}>
          <label><span>Years of experience *</span><input type="number" min="0" max="80" value={form.yearsExperience} onChange={(event) => setField("yearsExperience", event.target.value)} /></label>
          <label><span>Cover image URL</span><input type="url" value={form.coverUrl} onChange={(event) => setField("coverUrl", event.target.value)} placeholder="https://…" /></label>
        </div>

        {error && <p className={styles.error}>{error}</p>}
        {notice && <p className={styles.notice}>{notice}</p>}

        <div className={styles.actions}>
          <button className={styles.secondaryButton} type="submit" disabled={busy}>{busy ? "Working…" : "Save profile"}</button>
          {!published ? <button className={styles.primaryButton} type="button" onClick={publish} disabled={busy || readiness < 100}>Publish profile ↗</button> : <button className={styles.secondaryButton} type="button" onClick={unpublish} disabled={busy}>Unpublish</button>}
        </div>
      </form>

      <aside className={styles.preview}>
        <p className={styles.previewLabel}>LIVE PREVIEW</p>
        <div className={styles.cover} style={form.coverUrl ? { backgroundImage: `url(${form.coverUrl})` } : undefined} />
        <div className={styles.previewBody}>
          <div className={styles.previewAvatar}>{account.avatarUrl ? <img src={account.avatarUrl} alt="" /> : initial}</div>
          <div className={styles.verifiedRow}><strong>{account.displayName ?? "Your name"}</strong><span>HUSTLER · VERIFIED</span></div>
          <p className={styles.handle}>@{account.username ?? "username"} · {account.location ?? "Location"}</p>
          <h2>{form.headline || "Your professional headline"}</h2>
          <div className={styles.skillPills}>{[form.primarySkill, ...form.secondarySkills.split(",")].map((skill) => skill.trim()).filter(Boolean).slice(0, 6).map((skill) => <span key={skill}>{skill}</span>)}</div>
          <p className={styles.summary}>{form.professionalSummary || "Your professional summary will appear here."}</p>
          <div className={styles.meta}><span>{form.yearsExperience || "0"}+ yrs</span><span>{form.category || "Category"}</span></div>
          {published && account.username ? <a className={styles.publicLink} href={`/u/${account.username}`} target="_blank" rel="noreferrer">Open public profile ↗</a> : <small>Publish to make this profile publicly resolvable.</small>}
        </div>
      </aside>
    </section>
  </main>;
}
