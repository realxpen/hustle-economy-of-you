"use client";

import { useEffect, useState } from "react";
import type { HustleAccount } from "@hustle/types";
import { getMyAccount } from "../../lib/auth/hustle-account";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";

export default function AccountPage() {
  const [account, setAccount] = useState<HustleAccount | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { getMyAccount().then(setAccount).catch((reason) => { setError(reason.message); setTimeout(()=>window.location.assign("/auth"), 800); }); }, []);

  async function signOut() {
    await getSupabaseBrowserClient().auth.signOut();
    window.location.assign("/auth");
  }

  if (!account) return <main className="accountShell"><p>{error ?? "Loading your Hustle identity…"}</p></main>;
  const initial = (account.displayName ?? account.email ?? account.phone ?? "H").charAt(0).toUpperCase();

  return <main className="accountShell">
    <header className="topLine"><a className="brandMark" href="/">HUSTLE<span>↗</span></a><button className="textButton" onClick={signOut}>Sign out</button></header>
    <section className="identityHero">
      <div className="avatarBlock">{initial}</div>
      <div className="identityText"><p className="kicker">YOUR HUSTLE IDENTITY</p><h1>{account.displayName ?? "Your identity"}</h1><p>@{account.username ?? "username"} · {account.location ?? "Location not set"}</p></div>
      <a className="roundAction" href="/onboarding">Edit ↗</a>
    </section>
    <section className="accountGrid">
      <article className="capabilityCard"><small>CAPABILITIES</small><div className="capabilityList">{account.capabilities.map((item)=><div key={item.capability}><strong>{item.capability}</strong><span className={item.status.toLowerCase()}>{item.status}</span></div>)}</div><p>Capabilities accumulate on this identity. You never switch roles.</p></article>
      <article className="trustCard"><small>TRUST FOUNDATION</small><div className="trustMetric"><strong>{account.emailVerified || account.phoneVerified ? "Verified" : "Pending"}</strong><span>Contact identity</span></div><div className="trustMetric"><strong>One</strong><span>Reputation history</span></div></article>
      <article className="nextCard"><small>NEXT UNLOCK</small><h2>Show what you can do.</h2><p>Phase 3 will let eligible users apply for the Hustler capability without creating another account.</p><span className="futureTag">HUSTLER · LOCKED</span></article>
    </section>
  </main>;
}
