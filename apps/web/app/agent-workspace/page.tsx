"use client";

import { useEffect, useState } from "react";
import type { AgentRelationship, HustleAccount } from "@hustle/types";

import {
  acceptAgentRelationship,
  declineAgentRelationship,
  getAgentRepresentations,
  leaveAgentRelationship
} from "../../lib/agent-relationships";
import { getMyAccount } from "../../lib/auth/hustle-account";
import styles from "../agents/page.module.css";

const permissionLabels: Record<string, string> = {
  PROFILE_MANAGE: "Professional profile",
  SERVICE_MANAGE: "Services",
  PRODUCT_MANAGE: "Products",
  CONTENT_MANAGE: "Content",
  BOOKING_MANAGE: "Bookings",
  CLIENT_MESSAGE_MANAGE: "Client messages"
};

export default function AgentWorkspacePage() {
  const [account, setAccount] = useState<HustleAccount | null>(null);
  const [relationships, setRelationships] = useState<AgentRelationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { void refresh(); }, []);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [nextAccount, nextRelationships] = await Promise.all([
        getMyAccount(),
        getAgentRepresentations()
      ]);
      setAccount(nextAccount);
      setRelationships(nextRelationships);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load Agent workspace");
    } finally {
      setLoading(false);
    }
  }

  async function run(
    relationshipId: string,
    action: () => Promise<AgentRelationship>,
    message: string
  ) {
    setBusyId(relationshipId);
    setError(null);
    setNotice(null);
    try {
      await action();
      setNotice(message);
      setRelationships(await getAgentRepresentations());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Agent relationship action failed");
    } finally {
      setBusyId(null);
    }
  }

  const isAgent = account?.capabilities.some(
    (item) => item.capability === "AGENT" && item.status === "ACTIVE"
  ) ?? false;
  const pending = relationships.filter((item) => item.status === "PENDING");
  const active = relationships.filter((item) => item.status === "ACTIVE");
  const history = relationships.filter((item) => item.status === "DECLINED" || item.status === "REVOKED");

  if (loading) {
    return <main className={styles.shell}><p className={styles.loading}>Loading Agent workspace…</p></main>;
  }

  return <main className={styles.shell}>
    <header className={styles.topbar}>
      <a href="/account">← Your identity</a>
      <span>PHASE 18B · AGENT WORKSPACE</span>
    </header>

    <section className={styles.hero}>
      <div>
        <p className={styles.eyebrow}>DELEGATED TRUST</p>
        <h1>Represent with<br/><em>permission.</em></h1>
      </div>
      <p>
        Every Hustler relationship is explicit. You only receive the named scopes the
        Hustler grants, and those grants can be revoked at any time.
      </p>
    </section>

    {error && <p className={styles.error}>{error}</p>}
    {notice && <p className={styles.notice}>{notice}</p>}

    {!isAgent ? <section className={styles.boundary}>
      <strong>ACTIVE AGENT required.</strong>
      <p>Your Agent capability must be approved before you can receive Hustler invitations.</p>
      <a href="/agent-application">Open Agent application →</a>
    </section> : <>
      <section className={styles.workspaceSection}>
        <div className={styles.sectionHeading}><span>01</span><div><strong>Pending invitations</strong><p>Review the Hustler and exact permission scopes before accepting.</p></div></div>
        {pending.length === 0 ? <div className={styles.empty}><strong>No pending invitations.</strong></div> : pending.map((relationship) =>
          <article className={styles.card} key={relationship.id}>
            <div className={styles.cardHead}>
              <div className={styles.party}>
                <strong>{relationship.hustler.displayName ?? relationship.hustler.username ?? "Hustler"}</strong>
                <span>@{relationship.hustler.username ?? "hustler"} · {relationship.hustler.location ?? "Location not set"}</span>
              </div>
              <b className={styles.status}>PENDING</b>
            </div>
            <div className={styles.chips}>
              {relationship.permissions.map((grant) => <span key={grant.id}>{permissionLabels[grant.scope] ?? grant.scope}</span>)}
            </div>
            <div className={styles.actions}>
              <span>No authority becomes active until you accept.</span>
              <div>
                <button className={styles.secondary} disabled={busyId === relationship.id} onClick={() => run(relationship.id, () => declineAgentRelationship(relationship.id), "Invitation declined.")}>Decline</button>
                <button className={styles.primary} disabled={busyId === relationship.id} onClick={() => run(relationship.id, () => acceptAgentRelationship(relationship.id), "Relationship accepted. Granted scopes are now authoritative.")}>Accept</button>
              </div>
            </div>
          </article>
        )}
      </section>

      <section className={styles.workspaceSection}>
        <div className={styles.sectionHeading}><span>02</span><div><strong>Active representations</strong><p>One Agent can represent multiple Hustlers, each with independent grants.</p></div></div>
        {active.length === 0 ? <div className={styles.empty}><strong>No active Hustler relationships.</strong></div> : active.map((relationship) =>
          <article className={styles.card} key={relationship.id}>
            <div className={styles.cardHead}>
              <div className={styles.party}>
                <strong>{relationship.hustler.displayName ?? relationship.hustler.username ?? "Hustler"}</strong>
                <span>@{relationship.hustler.username ?? "hustler"} · {relationship.hustler.location ?? "Location not set"}</span>
              </div>
              <b className={styles.status}>ACTIVE</b>
            </div>
            <div className={styles.chips}>
              {relationship.permissions.map((grant) => <span key={grant.id}>{permissionLabels[grant.scope] ?? grant.scope}</span>)}
            </div>
            <div className={styles.actions}>
              <span>Phase 18B stores and audits these grants. It does not yet expose operational controls over this Hustler&apos;s business.</span>
              <button className={styles.danger} disabled={busyId === relationship.id} onClick={() => run(relationship.id, () => leaveAgentRelationship(relationship.id), "You left the relationship. Delegated authority is revoked.")}>Leave relationship</button>
            </div>
          </article>
        )}
      </section>

      {history.length > 0 && <section className={styles.workspaceSection}>
        <div className={styles.sectionHeading}><span>03</span><div><strong>Relationship history</strong><p>Closed invitations remain visible as lifecycle history.</p></div></div>
        <div className={styles.history}>
          {history.map((relationship) => <div key={relationship.id}>
            <span>{relationship.hustler.displayName ?? relationship.hustler.username ?? "Hustler"}</span>
            <b>{relationship.status}</b>
          </div>)}
        </div>
      </section>}
    </>}

    <section className={styles.boundary}>
      <strong>Money and reputation stay with the Hustler.</strong>
      <p>
        No relationship can transfer wallet balances, escrow, payouts, reviews, reputation,
        identity ownership or login access. Future delegated actions must check an ACTIVE
        relationship and the exact required permission before acting.
      </p>
    </section>
  </main>;
}
