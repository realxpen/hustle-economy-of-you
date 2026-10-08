"use client";

import { FormEvent, useEffect, useState } from "react";
import type {
  AgentAssistedRegistration,
  AgentPermissionScope,
  AssistedConsentMethod,
  HustleAccount
} from "@hustle/types";

import {
  createAssistedRegistration,
  listAssistedRegistrations
} from "../../../lib/agent-assisted-onboarding";
import { getMyAccount } from "../../../lib/auth/hustle-account";
import styles from "../../agents/page.module.css";

const optionalScopes: { value: AgentPermissionScope; label: string; detail: string }[] = [
  { value: "PROFILE_MANAGE", label: "Professional profile", detail: "Useful after the person becomes a Hustler." },
  { value: "SERVICE_MANAGE", label: "Services", detail: "Future delegated Service management after Hustler activation." },
  { value: "PRODUCT_MANAGE", label: "Products", detail: "Future delegated Product management after Hustler activation." },
  { value: "CONTENT_MANAGE", label: "Content", detail: "Help with approved content workflows." },
  { value: "BOOKING_MANAGE", label: "Bookings", detail: "Future Hustler-side booking assistance." },
  { value: "CLIENT_MESSAGE_MANAGE", label: "Client messages", detail: "Approved client communication assistance." }
];

export default function AssistedOnboardingHomePage() {
  const [account, setAccount] = useState<HustleAccount | null>(null);
  const [registrations, setRegistrations] = useState<AgentAssistedRegistration[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [location, setLocation] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [consentMethod, setConsentMethod] = useState<AssistedConsentMethod>("IN_PERSON");
  const [consentNote, setConsentNote] = useState("");
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [permissions, setPermissions] = useState<AgentPermissionScope[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getMyAccount(), listAssistedRegistrations()])
      .then(([nextAccount, nextRegistrations]) => {
        setAccount(nextAccount);
        setRegistrations(nextRegistrations);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Could not load assisted onboarding"))
      .finally(() => setLoading(false));
  }, []);

  const isAgent = account?.capabilities.some(
    (item) => item.capability === "AGENT" && item.status === "ACTIVE"
  ) ?? false;

  function toggleScope(scope: AgentPermissionScope) {
    setPermissions((current) =>
      current.includes(scope)
        ? current.filter((item) => item !== scope)
        : [...current, scope]
    );
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const registration = await createAssistedRegistration({
        displayName,
        username,
        location: location || null,
        email: email || null,
        phone: phone || null,
        consentConfirmed: true,
        consentMethod,
        consentNote: consentNote || null,
        permissions
      });
      window.location.assign(
        `/agent-workspace/onboarding/${encodeURIComponent(registration.id)}`
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create assisted identity");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <main className={styles.shell}><p className={styles.loading}>Loading assisted onboarding…</p></main>;
  }

  if (!isAgent) {
    return <main className={styles.shell}>
      <section className={styles.boundary}>
        <strong>ACTIVE AGENT required.</strong>
        <p>Only a verified Agent can register or assist another person.</p>
        <a href="/agent-application">Open Agent application →</a>
      </section>
    </main>;
  }

  return <main className={styles.shell}>
    <header className={styles.topbar}>
      <a href="/agent-workspace">← Agent workspace</a>
      <span>PHASE 18C · ASSISTED ONBOARDING</span>
    </header>

    <section className={styles.hero}>
      <div>
        <p className={styles.eyebrow}>REGISTER WITH THEM, NOT AS THEM</p>
        <h1>Help someone<br/><em>join Hustle.</em></h1>
      </div>
      <p>
        Create a Client identity from your device when the person needs help using technology.
        Record their consent. They remain the owner and can claim this same identity later.
      </p>
    </section>

    {error && <p className={styles.error}>{error}</p>}

    <section className={styles.panelGrid}>
      <form className={styles.invitePanel} onSubmit={create}>
        <p className={styles.panelLabel}>01 · PERSON & CONSENT</p>
        <h2>Create an assisted identity.</h2>

        <label className={styles.field}>
          <span>Person&apos;s name</span>
          <input required maxLength={80} value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="How people know them" />
        </label>

        <label className={styles.field}>
          <span>Hustle username</span>
          <input required minLength={3} maxLength={30} value={username} onChange={(event) => setUsername(event.target.value)} placeholder="username" />
        </label>

        <label className={styles.field}>
          <span>Location</span>
          <input maxLength={120} value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Lagos, Nigeria" />
        </label>

        <label className={styles.field}>
          <span>Email — optional</span>
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Used later to claim the account" />
        </label>

        <label className={styles.field}>
          <span>Phone — optional</span>
          <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+234..." />
        </label>

        <label className={styles.field}>
          <span>How consent was given</span>
          <select value={consentMethod} onChange={(event) => setConsentMethod(event.target.value as AssistedConsentMethod)}>
            <option value="IN_PERSON">In person</option>
            <option value="PHONE">Phone</option>
            <option value="WRITTEN">Written</option>
            <option value="OTHER">Other</option>
          </select>
        </label>

        <label className={styles.field}>
          <span>Consent note — optional</span>
          <input maxLength={1000} value={consentNote} onChange={(event) => setConsentNote(event.target.value)} placeholder="Any useful context about the assisted registration" />
        </label>

        <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 12, lineHeight: 1.5 }}>
          <input type="checkbox" checked={consentConfirmed} onChange={(event) => setConsentConfirmed(event.target.checked)} />
          <span>I confirm this person explicitly asked me to create and assist with their Hustle identity.</span>
        </label>

        <button className={styles.primary} type="submit" disabled={busy || !consentConfirmed || !displayName.trim() || !username.trim()}>
          {busy ? "Creating…" : "Create assisted Client"}
        </button>
      </form>

      <div className={styles.relationshipPanel}>
        <p className={styles.panelLabel}>02 · OPTIONAL FUTURE SCOPES</p>
        <div className={styles.scopeGrid}>
          {optionalScopes.map((option) => {
            const active = permissions.includes(option.value);
            return <button type="button" key={option.value} className={active ? styles.scopeActive : styles.scopeButton} onClick={() => toggleScope(option.value)}>
              <strong>{option.label}</strong>
              <span>{option.detail}</span>
            </button>;
          })}
        </div>

        <section className={styles.boundary}>
          <strong>Always included.</strong>
          <p>
            Account onboarding and Hustler-application management are automatically granted for
            this assisted registration. Business scopes do nothing until the underlying account
            has the capability required by that business action.
          </p>
        </section>

        <p className={styles.panelLabel}>03 · PEOPLE YOU ARE ASSISTING</p>
        {registrations.length === 0 ? <div className={styles.empty}>
          <strong>No assisted identities yet.</strong>
          <p>Create one above when someone asks you to help them join Hustle.</p>
        </div> : registrations.map((registration) => <article className={styles.card} key={registration.id}>
          <div className={styles.cardHead}>
            <div className={styles.party}>
              <strong>{registration.principal.displayName ?? registration.principal.username ?? "Hustle user"}</strong>
              <span>@{registration.principal.username ?? "user"} · {registration.principal.location ?? "Location not set"}</span>
            </div>
            <b className={styles.status}>{registration.status}</b>
          </div>
          <div className={styles.actions}>
            <span>
              {registration.principal.hustlerApplication
                ? `Hustler application: ${registration.principal.hustlerApplication.status}`
                : "Hustler application not started"}
            </span>
            {registration.status === "ACTIVE"
              ? <a href={`/agent-workspace/onboarding/${registration.id}`}>Continue →</a>
              : <span>Claimed or closed · permission setup ended; ongoing representation is owner-controlled</span>}
          </div>
        </article>)}
      </div>
    </section>
  </main>;
}
