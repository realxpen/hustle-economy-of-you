"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { stageSignIn } from "../../lib/auth/isolated-web-auth";
import { invalidateAuthenticatedSessionCache } from "../../lib/api/authenticated-fetch";
import { syncHustleAccount } from "../../lib/auth/hustle-account";
import styles from "./staging-sign-in.module.css";

export function StagingWebSignIn() {
  const router=useRouter();
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [creating,setCreating]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);
  async function submit(event:FormEvent) {
    event.preventDefault();
    if(busy) return;
    setBusy(true);setError(null);
    try {
      await stageSignIn(email,password,creating);
      setPassword("");
      invalidateAuthenticatedSessionCache();
      await syncHustleAccount();
      router.replace("/home");
      router.refresh();
    } catch {
      // Do not reveal whether an email is on the server's test invite list.
      setError("Unable to confirm your test session. Check your invited email, password and connection.");
    } finally { setBusy(false); }
  }
  return <main className={styles.screen}>
    <section className={styles.card} aria-labelledby="title">
      <div className={styles.brand}>hustle<span>.</span></div>
      <p className={styles.kicker}>PRIVATE TEST · ISOLATED STAGING</p>
      <h1 id="title">{creating ? "Create your test account." : "Enter your Hustle."}</h1>
      <p className={styles.description}>Use the same invited test email as the connected Android preview. Accounts and transactions are separate from production.</p>
      <form className={styles.form} onSubmit={submit}>
        <label>Email address <input type="email" autoComplete="email" inputMode="email" required
          placeholder="Invited test email" value={email} onChange={e=>setEmail(e.target.value)} disabled={busy}/></label>
        <label>Password <input type="password" minLength={12} maxLength={128}
          autoComplete={creating?"new-password":"current-password"} required
          placeholder="At least 12 characters" value={password} onChange={e=>setPassword(e.target.value)} disabled={busy}/></label>
        {error && <p role="alert" className={styles.error}>{error}</p>}
        <button type="submit" disabled={busy}>{busy?"Checking…":creating?"Create invited test account":"Sign in"}</button>
        <button type="button" className={styles.switch} disabled={busy}
          onClick={()=>{setCreating(!creating);setError(null);}}>
          {creating?"Already registered? Sign in":"Create invited test account"}
        </button>
      </form>
      <small className={styles.disclaimer}>For internal non-financial testing only. Don't reuse a real password.</small>
    </section>
  </main>;
}
