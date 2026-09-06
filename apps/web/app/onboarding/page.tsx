"use client";

import { FormEvent, useEffect, useState } from "react";
import type { HustleAccount } from "@hustle/types";
import { getMyAccount, syncHustleAccount, updateMyProfile } from "../../lib/auth/hustle-account";

export default function OnboardingPage() {
  const [account, setAccount] = useState<HustleAccount | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [location, setLocation] = useState("");
  const [bio, setBio] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    syncHustleAccount().then((value) => {
      setAccount(value); setDisplayName(value.displayName ?? ""); setUsername(value.username ?? ""); setLocation(value.location ?? ""); setBio(value.bio ?? "");
    }).catch(async () => {
      try { setAccount(await getMyAccount()); } catch { window.location.assign("/auth"); }
    });
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(null);
    try {
      const updated = await updateMyProfile({ displayName, username, location, bio });
      setAccount(updated); window.location.assign("/account");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save profile"); }
    finally { setSaving(false); }
  }

  return <main className="onboardingShell">
    <header className="topLine"><a className="brandMark" href="/">HUSTLE<span>↗</span></a><span>Identity setup · 01</span></header>
    <section className="onboardingGrid">
      <div className="onboardingIntro"><p className="kicker">MAKE YOURSELF DISCOVERABLE</p><h1>One identity.<br/><em>Built to grow.</em></h1><p>This profile becomes the foundation for everything you do on Hustle—as a client today and, if approved later, as a Hustler or Agent.</p><div className="clientStamp"><small>STARTING CAPABILITY</small><strong>CLIENT</strong><span>Automatically enabled</span></div></div>
      <form className="profileForm" onSubmit={submit}>
        <div className="formIndex">01 — BASICS</div>
        <label><span>Your name</span><input required maxLength={80} value={displayName} onChange={(e)=>setDisplayName(e.target.value)} placeholder="How people know you" /></label>
        <label><span>Username</span><div className="usernameField"><b>@</b><input required minLength={3} maxLength={30} value={username} onChange={(e)=>setUsername(e.target.value)} placeholder="yourname" /></div></label>
        <label><span>Location</span><input maxLength={120} value={location} onChange={(e)=>setLocation(e.target.value)} placeholder="Lagos, Nigeria" /></label>
        <label><span>About you</span><textarea maxLength={300} value={bio} onChange={(e)=>setBio(e.target.value)} placeholder="What should people know about you?" rows={4}/><small>{bio.length}/300</small></label>
        {account && <p className="verificationLine">{account.emailVerified || account.phoneVerified ? "✓ Contact verified" : "○ Contact verification pending"}</p>}
        {error && <p className="formNotice errorNotice">{error}</p>}
        <button className="primaryAction" type="submit" disabled={saving}><span>{saving ? "Saving…" : "Build my identity"}</span><b>↗</b></button>
      </form>
    </section>
  </main>;
}
