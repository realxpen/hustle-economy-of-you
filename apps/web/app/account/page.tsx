"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { HustleAccount } from "@hustle/types";
import { ExperienceHeader } from "../../components/navigation/experience-header";
import { ExperienceState } from "../../components/experience/experience-state";
import { TrustActivityCenter } from "../../components/trust/trust-activity-center";
import { AttributionConsentSettings } from "../../components/privacy/attribution-consent";
import { getMyAccount } from "../../lib/auth/hustle-account";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";
import styles from "./page.module.css";

type GlyphName = "calendar" | "bag" | "chat" | "wallet" | "play" | "spark" | "store" | "box" | "shield" | "user" | "agent";

function Glyph({ name }: { name: GlyphName }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" {...common}>
    {name === "calendar" && <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M7 15h4"/></>}
    {name === "bag" && <><rect x="4" y="7" width="16" height="14" rx="2"/><path d="M9 9V6a3 3 0 0 1 6 0v3M8 14h8"/></>}
    {name === "chat" && <><path d="M20 11.5c0 4.7-3.8 8-8.5 8-1.4 0-2.8-.3-4-.9L3 20l1.6-4A8 8 0 0 1 3 11.5C3 7 6.9 4 11.5 4S20 7 20 11.5Z"/><path d="M8 11.5h8"/></>}
    {name === "wallet" && <><rect x="3" y="6" width="18" height="15" rx="2"/><path d="M3 9V5a2 2 0 0 1 2-2h13M15 14h6M16 14h1"/></>}
    {name === "play" && <><rect x="3" y="4" width="18" height="16" rx="3"/><path d="m10 8 6 4-6 4V8Z"/></>}
    {name === "spark" && <><path d="m12 2 2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2L12 2Z"/></>}
    {name === "store" && <><path d="M4 9h16l-1.4-5H5.4L4 9ZM5 9v11h14V9M9 20v-7h6v7M4 9c0 3 4 3 4 0 0 3 4 3 4 0 0 3 4 3 4 0 0 3 4 3 4 0"/></>}
    {name === "box" && <><path d="m12 2 9 5-9 5-9-5 9-5ZM3 7v10l9 5 9-5V7M12 12v10"/></>}
    {name === "shield" && <><path d="m12 2 8 3v6c0 5-3.3 9-8 11-4.7-2-8-6-8-11V5l8-3Z"/><path d="m8.5 12 2.3 2.3 4.8-5"/></>}
    {name === "user" && <><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.4-7 8-7s8 2.6 8 7"/></>}
    {name === "agent" && <><circle cx="12" cy="5" r="2"/><circle cx="5" cy="18" r="2"/><circle cx="19" cy="18" r="2"/><path d="M12 7v5M12 12l-7 4M12 12l7 4"/></>}
  </svg>;
}

function ActionTile({ href, icon, title, description }: { href: string; icon: GlyphName; title: string; description: string }) {
  return <Link href={href} className={styles.actionTile}>
    <span className={styles.actionIcon}><Glyph name={icon} /></span>
    <span className={styles.actionText}><strong>{title}</strong><small>{description}</small></span>
    <span className={styles.tileArrow} aria-hidden="true">↗</span>
  </Link>;
}

function ToolRow({ href, icon, label, supporting }: { href: string; icon: GlyphName; label: string; supporting: string }) {
  return <Link href={href} className={styles.toolRow}>
    <span className={styles.toolIcon}><Glyph name={icon} /></span>
    <span className={styles.toolText}><strong>{label}</strong><small>{supporting}</small></span>
    <span aria-hidden="true" className={styles.chevron}>›</span>
  </Link>;
}

export default function AccountPage() {
  const [account, setAccount] = useState<HustleAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [signingOut, setSigningOut] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [trustOpen, setTrustOpen] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void getMyAccount({ force: refreshVersion > 0 })
      .then((value) => { if (active) setAccount(value); })
      .catch((reason: Error) => { if (active) setError(reason.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refreshVersion]);

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    setError(null);
    try {
      const { error: authError } = await getSupabaseBrowserClient().auth.signOut();
      if (authError) throw authError;
      window.location.assign("/auth");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not sign out. Please try again.");
      setSigningOut(false);
    }
  }

  if (loading && !account) return <main className={[styles.page, "h-adaptive"].join(" ")}>
    <ExperienceHeader section="You" />
    <ExperienceState kind="loading" title="Preparing your space…" />
  </main>;

  if (!account) return <main className={[styles.page, "h-adaptive"].join(" ")}>
    <ExperienceHeader section="You" />
    <ExperienceState kind="error" title="Your account is unavailable." description={error ?? "Could not load your Hustle identity."}
      action={{ label: "Try again", onClick: () => setRefreshVersion((n) => n + 1) }} />
    <p className={styles.authHelp}><Link href="/auth">Go to sign in</Link></p>
  </main>;

  const initial = (account.displayName ?? account.username ?? account.email ?? "H").charAt(0).toUpperCase();
  const contactVerified = Boolean(account.emailVerified || account.phoneVerified);
  const hustlerActive = account.capabilities.some((entry) => entry.capability === "HUSTLER" && entry.status === "ACTIVE");
  const agentActive = account.capabilities.some((entry) => entry.capability === "AGENT" && entry.status === "ACTIVE");
  const displayName = account.displayName || "Your Hustle identity";
  const profileLabel = account.username ? "@" + account.username : "Set a username";

  return <main className={[styles.page, "h-adaptive"].join(" ")}>
    <ExperienceHeader section="You" actions={<button className={styles.signOut} type="button"
      disabled={signingOut} onClick={() => void signOut()}>{signingOut ? "Signing out…" : "Sign out ↗"}</button>} />

    <div className={styles.intro}>
      <div><span className={styles.eyebrow}>YOUR SPACE</span><p>Everything you create, earn and manage. One Hustle identity.</p></div>
      <Link href="/onboarding" className={styles.editProfile}>Edit profile <span aria-hidden="true">↗</span></Link>
    </div>

    <section className={styles.profileHero} aria-labelledby="account-name">
      <div className={styles.heroGlow} aria-hidden="true" />
      <div className={styles.profileIdentity}>
        <span className={styles.avatar} aria-label={"Avatar initial " + initial}>{initial}</span>
        <div className={styles.heroCopy}>
          <span className={styles.heroOverline}>THE ECONOMY OF YOU</span>
          <h1 id="account-name">{displayName}</h1>
          <div className={styles.handleRow}><span>{profileLabel}</span><span aria-hidden="true">·</span><span>{account.location || "Set your location"}</span></div>
        </div>
      </div>
      <div className={styles.heroFooter}>
        <span className={styles.identityBadge}><span className={styles.liveDot} aria-hidden="true" /> One account, many possibilities</span>
        <span className={styles.contactBadge}>{contactVerified ? "✓ Contact verified" : "Contact verification pending"}</span>
      </div>
    </section>

    {error && <p className={styles.inlineError} role="alert">{error} <button type="button" onClick={() => setRefreshVersion((n)=>n+1)}>Retry</button></p>}

    <section className={styles.capabilities} aria-label="Your Hustle capabilities">
      <div className={styles.capabilityHeading}>
        <div><span className={styles.eyebrow}>ONE IDENTITY</span><h2>Your capabilities</h2></div>
        <p>Access grows with approval. No account switching.</p>
      </div>
      <div className={styles.capabilityPills}>
        {account.capabilities.map((entry) => <div className={styles.capabilityPill} key={entry.capability}>
          <span className={styles.capabilityName}>{entry.capability}</span>
          <span className={entry.status === "ACTIVE" ? styles.capabilityActive : styles.capabilityPending}>{entry.status.replaceAll("_", " ")}</span>
        </div>)}
      </div>
    </section>

    <section className={styles.section} aria-labelledby="your-activity-title">
      <div className={styles.sectionHeader}><div><span className={styles.eyebrow}>YOUR DAILY FLOW</span><h2 id="your-activity-title">Your activity</h2></div><Link href="/notifications" className={styles.subtleLink}>Activity & alerts ↗</Link></div>
      <div className={styles.shortcutGrid}>
        <ActionTile href="/bookings" icon="calendar" title="Bookings" description="Requests and appointments" />
        <ActionTile href="/orders" icon="bag" title="Orders" description="Purchases and status" />
        <ActionTile href="/messages" icon="chat" title="Messages" description="Conversations and consultations" />
        <ActionTile href="/wallet" icon="wallet" title="Wallet" description="Balances and transactions" />
      </div>
    </section>

    <section className={styles.section} aria-labelledby="creator-tools-title">
      <div className={styles.sectionHeader}><div><span className={styles.eyebrow}>SHOW WHAT YOU DO</span><h2 id="creator-tools-title">{hustlerActive ? "Your Hustler studio" : "Create & grow"}</h2></div><Link href="/home" className={styles.subtleLink}>Back to Discover ↗</Link></div>
      <div className={styles.studio}>
        <div className={styles.studioLead}>
          <span className={styles.studioStamp} aria-hidden="true"><Glyph name="spark" /></span>
          <span className={styles.eyebrow}>MAKE YOUR WORK VISIBLE</span>
          <h3>Turn what you do into opportunity.</h3>
          <p>{hustlerActive ? "Publish real work, organize your offers, and grow your professional presence." : "Start with a post or Story. Apply to offer paid services and products as a Hustler."}</p>
          <Link href={hustlerActive ? "/professional-profile" : "/hustler-application"} className={styles.studioCta}>
            {hustlerActive ? "Manage professional profile" : "Become a Hustler"} <span aria-hidden="true">↗</span>
          </Link>
        </div>
        <div className={styles.studioLinks}>
          <ToolRow href="/posts/new" icon="play" label="Create a post" supporting="Show your work to the community" />
          <ToolRow href="/stories/create" icon="spark" label="Share a Story" supporting="An update that lasts 24 hours" />
          {hustlerActive && <>
            <ToolRow href="/posts/manage" icon="play" label="Manage posts" supporting="Your published work and drafts" />
            <ToolRow href="/services/manage" icon="store" label="Your services" supporting="Create and manage bookable offers" />
            <ToolRow href="/products/manage" icon="box" label="Your products" supporting="Catalog and inventory" />
            <ToolRow href="/live/create" icon="spark" label="Go Live" supporting="Prepare a live demonstration" />
          </>}
        </div>
      </div>
    </section>

    <section className={styles.section} aria-labelledby="account-settings-title">
      <div className={styles.sectionHeader}><div><span className={styles.eyebrow}>CONTROL & CONFIDENCE</span><h2 id="account-settings-title">Account & safety</h2></div></div>
      <div className={styles.settingsGrid}>
        <div className={styles.settingsCard}>
          <h3>Identity and permissions</h3>
          <ToolRow href="/onboarding" icon="user" label="Personal information" supporting="Name, username and location" />
          <ToolRow href="/agents/manage" icon="agent" label="Agent permissions" supporting="Review people acting on your behalf" />
          <ToolRow href={agentActive ? "/agent-workspace" : "/agent-application"} icon="agent"
            label={agentActive ? "Agent workspace" : "Agent application"} supporting={agentActive ? "Your authorized Agent tools" : "Apply for Agent capability"} />
          <ToolRow href="/appeals" icon="shield" label="Appeals & enforcement" supporting="Account decisions and safety" />
        </div>
        <div className={styles.settingsCard}>
          <h3>Discover and your preferences</h3>
          <ToolRow href="/marketplace" icon="store" label="Marketplace" supporting="Browse goods and services" />
          <ToolRow href="/cart" icon="bag" label="Your cart" supporting="Saved purchase choices" />
          <ToolRow href="/search" icon="spark" label="Find Hustlers" supporting="Search skills and people" />
          <ToolRow href="/notifications" icon="chat" label="Notifications" supporting="Account and activity alerts" />
        </div>
      </div>
      <div className={styles.privacyPanels}>
        <details className={styles.disclosure} id="privacy-settings" onToggle={(event) => setPrivacyOpen(event.currentTarget.open)}>
          <summary><span className={styles.disclosureIcon}><Glyph name="shield" /></span><span><strong>Privacy & optional analytics</strong><small>Choose how discovery attribution works</small></span><span aria-hidden="true" className={styles.disclosureArrow}>⌄</span></summary>
          {privacyOpen && <div className={styles.disclosureBody}><AttributionConsentSettings /></div>}
        </details>
        <details className={styles.disclosure} id="trust-activity" onToggle={(event) => setTrustOpen(event.currentTarget.open)}>
          <summary><span className={styles.disclosureIcon}><Glyph name="shield" /></span><span><strong>Trust & safety activity</strong><small>Your reviews, private reports and blocks</small></span><span aria-hidden="true" className={styles.disclosureArrow}>⌄</span></summary>
          {trustOpen && <div className={styles.disclosureBody}><TrustActivityCenter /></div>}
        </details>
      </div>
    </section>
    <footer className={styles.footer}><strong>HUSTLE<span>↗</span></strong><span>The economy of you.</span></footer>
  </main>;
}
