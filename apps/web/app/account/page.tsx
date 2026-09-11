"use client";

import { useEffect, useState } from "react";
import type { HustleAccount } from "@hustle/types";
import { getMyAccount } from "../../lib/auth/hustle-account";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";

export default function AccountPage() {
  const [account, setAccount] = useState<HustleAccount | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMyAccount()
      .then(setAccount)
      .catch((reason) => {
        setError(reason.message);
        setTimeout(() => window.location.assign("/auth"), 800);
      });
  }, []);

  async function signOut() {
    await getSupabaseBrowserClient().auth.signOut();
    window.location.assign("/auth");
  }

  if (!account) {
    return <main className="accountShell"><p>{error ?? "Loading your Hustle identity…"}</p></main>;
  }

  const initial = (account.displayName ?? account.email ?? account.phone ?? "H").charAt(0).toUpperCase();
  const hustler = account.capabilities.find((item) => item.capability === "HUSTLER");
  const isHustler = hustler?.status === "ACTIVE";

  return <main className="accountShell">
    <header className="topLine"><a className="brandMark" href="/">HUSTLE<span>↗</span></a><button className="textButton" onClick={signOut}>Sign out</button></header>
    <section className="identityHero">
      <div className="avatarBlock">{initial}</div>
      <div className="identityText"><p className="kicker">YOUR HUSTLE IDENTITY</p><h1>{account.displayName ?? "Your identity"}</h1><p>@{account.username ?? "username"} · {account.location ?? "Location not set"}</p></div>
      <a className="roundAction" href="/onboarding">Edit ↗</a>
    </section>
    <section className="accountGrid">
      <article className="capabilityCard"><small>CAPABILITIES</small><div className="capabilityList">{account.capabilities.map((item) => <div key={item.capability}><strong>{item.capability}</strong><span className={item.status.toLowerCase()}>{item.status}</span></div>)}</div><p>Capabilities accumulate on this identity. You never switch roles.</p></article>
      <article className="trustCard"><small>TRUST FOUNDATION</small><div className="trustMetric"><strong>{account.emailVerified || account.phoneVerified ? "Verified" : "Pending"}</strong><span>Contact identity</span></div><div className="trustMetric"><strong>One</strong><span>Reputation history</span></div></article>
      <article className="nextCard">
        <small>{isHustler ? "PROFESSIONAL ECONOMY" : "NEXT UNLOCK"}</small>
        <h2>{isHustler ? "Turn capability into proof and offers." : "Show what you can do."}</h2>
        <p>{isHustler ? "Your professional identity carries services, products and capability-led content on this same account." : "Apply with your skill, experience and real proof. Approval adds Hustler to this identity without creating another account."}</p>
        <a className="primaryLink" href="/home"><span>Open discovery feed</span><b>↗</b></a>
        <a className="futureTag" href="/cart">CART →</a>
        <a className="futureTag" href="/orders">ORDERS →</a>
        <a className="futureTag" href="/bookings">BOOKINGS →</a>
        <a className="futureTag" href="/messages">MESSAGES →</a>
        <a className="futureTag" href="/search">SEARCH HUSTLE →</a>
        <a className="futureTag" href="/marketplace">BROWSE MARKETPLACE →</a>
        <a className="futureTag" href={isHustler ? "/professional-profile" : "/hustler-application"}>{isHustler ? "EDIT PROFESSIONAL PROFILE →" : "APPLY TO BECOME A HUSTLER →"}</a>
        {isHustler && <a className="futureTag" href="/posts/manage">MANAGE CONTENT →</a>}
        {isHustler && <a className="futureTag" href="/services/manage">MANAGE SERVICES →</a>}
        {isHustler && <a className="futureTag" href="/products/manage">MANAGE PRODUCTS →</a>}
      </article>
    </section>
  </main>;
}
