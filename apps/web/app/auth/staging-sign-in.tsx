"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { stageSignIn } from "../../lib/auth/isolated-web-auth";
import { invalidateAuthenticatedSessionCache } from "../../lib/api/authenticated-fetch";
import { invalidateMyAccountCache, syncHustleAccount } from "../../lib/auth/hustle-account";
import { onboardingUrlFor, safeAuthNext } from "../../lib/auth/safe-auth-next";
import styles from "./staging-sign-in.module.css";

/**
 * Reuses the approved V1 authentication design. Only the credential transport
 * changes in the isolated tester: first-party Better Auth, not Supabase.
 */
export function StagingWebSignIn() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(null);
    try {
      await stageSignIn(email, password, creating);
      // A new session must never inherit a previous viewer's identity cache.
      invalidateAuthenticatedSessionCache();
      invalidateMyAccountCache();
      const account = await syncHustleAccount();
      setPassword("");
      const next = safeAuthNext(new URLSearchParams(window.location.search).get("next"));
      // One account starts as CLIENT. Complete the real profile before entering
      // the original service/profile opportunity, never jump past onboarding.
      router.replace(account.onboardingCompleted
        ? next ?? "/home"
        : onboardingUrlFor(next));
      router.refresh();
    } catch {
      // Do not disclose which test email addresses were invited.
      setError("Unable to confirm your test session. Check your invited email, password and connection.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="authShell">
    <section className="authStory" aria-label="Hustle identity">
      <a className="brandMark" href="/">HUSTLE<span>↗</span></a>
      <div className="storyStack">
        <p className="kicker">ONE IDENTITY / MANY POSSIBILITIES</p>
        <h1>Your work deserves to be <em>seen.</em></h1>
        <p>Start as a Client. Build one reputation. Unlock Hustler and Agent
          capabilities as your journey grows—without switching accounts.</p>
      </div>
      <div className="storyLoop">
        <span>Discover</span><span>Trust</span><span>Hire</span><span>Grow</span>
      </div>
    </section>

    <section className="authPanel">
      <div className="authCard">
        <div className="authHeading">
          <span>PRIVATE TEST · ISOLATED STAGING</span>
          <h2>{creating ? "Create your Hustle identity." : "Sign in to Hustle."}</h2>
        </div>
        <p className={styles.info}>Use an invited test email and a unique test password.
          This preview is separate from production accounts and payments.</p>
        <form onSubmit={submit} className="authForm">
          <label><span>Email address</span>
            <input type="email" autoComplete="email" inputMode="email" required
              placeholder="Invited test email" value={email}
              onChange={e => setEmail(e.target.value)} disabled={busy}/>
          </label>
          <label><span>Password</span>
            <div className={styles.passwordRow}>
              <input type={showPassword ? "text" : "password"} minLength={12} maxLength={128}
                autoComplete={creating ? "new-password" : "current-password"} required
                placeholder="At least 12 characters" value={password}
                onChange={e => setPassword(e.target.value)} disabled={busy}/>
              <button type="button" onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword} disabled={busy}>
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </label>
          {error && <p role="alert" className="formNotice errorNotice">{error}</p>}
          <button type="submit" className="primaryAction" disabled={busy}>
            <span>{busy ? "Checking…" : creating ? "Create test account" : "Enter Hustle"}</span>
            <b aria-hidden="true">↗</b>
          </button>
        </form>
        <div className="authFooterActions">
          <button type="button" onClick={() => {setCreating(v => !v);setError(null);}}
            disabled={busy}>
            {creating ? "Already registered? Sign in" : "New here? Create test account"}
          </button>
          <a href="/home">Explore as a guest →</a>
        </div>
        <p className={styles.disclaimer}>Only invited test accounts are supported here.
          Do not use your real Hustle password or financial details.</p>
      </div>
      <p className="authPrinciple">One account. One reputation. No role switching.</p>
    </section>
  </main>;
}
