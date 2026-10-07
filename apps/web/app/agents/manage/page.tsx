"use client";

import { FormEvent, useEffect, useState } from "react";
import type { AgentPermissionScope, AgentRelationship, HustleAccount } from "@hustle/types";

import {
  getHustlerAgentRelationships,
  inviteAgent,
  revokeAgentRelationship,
  updateAgentPermissions
} from "../../../lib/agent-relationships";
import { getMyAccount } from "../../../lib/auth/hustle-account";
import styles from "../page.module.css";

const permissionOptions: { value: AgentPermissionScope; label: string; detail: string }[] = [
  { value: "PROFILE_MANAGE", label: "Professional profile", detail: "Prepare and maintain professional identity details." },
  { value: "SERVICE_MANAGE", label: "Services", detail: "Prepare and maintain service listings." },
  { value: "PRODUCT_MANAGE", label: "Products", detail: "Prepare and maintain product listings." },
  { value: "CONTENT_MANAGE", label: "Content", detail: "Prepare professional posts and portfolio content." },
  { value: "BOOKING_MANAGE", label: "Bookings", detail: "Assist with booking and schedule operations." },
  { value: "CLIENT_MESSAGE_MANAGE", label: "Client messages", detail: "Assist with approved client communication." }
];

function scopesOf(relationship: AgentRelationship) {
  return relationship.permissions.filter((item) => item.active).map((item) => item.scope);
}

export default function ManageAgentsPage() {
  const [account, setAccount] = useState<HustleAccount | null>(null);
  const [relationships, setRelationships] = useState<AgentRelationship[]>([]);
  const [agentUsername, setAgentUsername] = useState("");
  const [permissions, setPermissions] = useState<AgentPermissionScope[]>([]);
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
        getHustlerAgentRelationships()
      ]);
      setAccount(nextAccount);
      setRelationships(nextRelationships);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load Agent relationships");
    } finally {
      setLoading(false);
    }
  }

  function toggleInviteScope(scope: AgentPermissionScope) {
    setPermissions((current) =>
      current.includes(scope) ? current.filter((item) => item !== scope) : [...current, scope]
    );
  }

  async function submitInvitation(event: FormEvent) {
    event.preventDefault();
    if (permissions.length === 0) {
      setError("Choose at least one permission before inviting an Agent.");
      return;
    }

    setBusyId("invite");
    setError(null);
    setNotice(null);
    try {
      await inviteAgent({ agentUsername, permissions });
      setAgentUsername("");
      setPermissions([]);
      setNotice("Agent invitation sent. Authority stays inactive until the Agent accepts.");
      setRelationships(await getHustlerAgentRelationships());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not invite Agent");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleRelationshipScope(relationship: AgentRelationship, scope: AgentPermissionScope) {
    const current = scopesOf(relationship);
    const next = current.includes(scope)
      ? current.filter((item) => item !== scope)
      : [...current, scope];

    if (next.length === 0) {
      setError("An active or pending relationship must retain at least one permission. Revoke it instead if no authority should remain.");
      return;
    }

    setBusyId(relationship.id);
    setError(null);
    setNotice(null);
    try {
      await updateAgentPermissions(relationship.id, { permissions: next });
      setNotice("Permission grant updated and audited.");
      setRelationships(await getHustlerAgentRelationships());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update permissions");
    } finally {
      setBusyId(null);
    }
  }

  async function revoke(relationship: AgentRelationship) {
    setBusyId(relationship.id);
    setError(null);
    setNotice(null);
    try {
      await revokeAgentRelationship(relationship.id);
      setNotice("Agent authority revoked. Existing Hustle ownership remains unchanged.");
      setRelationships(await getHustlerAgentRelationships());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not revoke Agent relationship");
    } finally {
      setBusyId(null);
    }
  }

  const isHustler = account?.capabilities.some(
    (item) => item.capability === "HUSTLER" && item.status === "ACTIVE"
  ) ?? false;

  if (loading) {
    return <main className={styles.shell}><p className={styles.loading}>Loading Agent relationships…</p></main>;
  }

  return <main className={styles.shell}>
    <header className={styles.topbar}>
      <a href="/account">← Your identity</a>
      <span>PHASE 18B · HUSTLER AUTHORITY</span>
    </header>

    <section className={styles.hero}>
      <div>
        <p className={styles.eyebrow}>REPRESENTATION</p>
        <h1>Your business.<br/><em>Your permission.</em></h1>
      </div>
      <p>
        Invite an approved Hustle Agent and choose exactly what they may help with.
        No grant transfers ownership, wallet authority, reviews, reputation, escrow or payouts.
      </p>
    </section>

    {error && <p className={styles.error}>{error}</p>}
    {notice && <p className={styles.notice}>{notice}</p>}

    {!isHustler ? <section className={styles.boundary}>
      <strong>ACTIVE HUSTLER required.</strong>
      <p>Only a Hustler can grant representation authority over a professional business.</p>
      <a href="/hustler-application">Apply to become a Hustler →</a>
    </section> : <section className={styles.panelGrid}>
      <form className={styles.invitePanel} onSubmit={submitInvitation}>
        <p className={styles.panelLabel}>01 · INVITE AN APPROVED AGENT</p>
        <h2>Choose the person, then the authority.</h2>
        <label className={styles.field}>
          <span>Agent username</span>
          <input
            value={agentUsername}
            onChange={(event) => setAgentUsername(event.target.value)}
            placeholder="@username"
            maxLength={80}
            required
          />
        </label>
        <div className={styles.scopeGrid}>
          {permissionOptions.map((option) => {
            const active = permissions.includes(option.value);
            return <button
              type="button"
              key={option.value}
              className={active ? styles.scopeActive : styles.scopeButton}
              onClick={() => toggleInviteScope(option.value)}
            >
              <strong>{option.label}</strong>
              <span>{option.detail}</span>
            </button>;
          })}
        </div>
        <button
          className={styles.primary}
          type="submit"
          disabled={busyId === "invite" || !agentUsername.trim() || permissions.length === 0}
        >
          {busyId === "invite" ? "Sending…" : "Send Agent invitation"}
        </button>
        <small>Invitation is not authority. The relationship becomes ACTIVE only after the Agent accepts.</small>
      </form>

      <div className={styles.relationshipPanel}>
        <p className={styles.panelLabel}>02 · YOUR AGENT RELATIONSHIPS</p>
        {relationships.length === 0 ? <div className={styles.empty}>
          <strong>No Agent relationships yet.</strong>
          <p>Invite an approved Agent when you want help managing selected professional workflows.</p>
        </div> : relationships.map((relationship) => {
          const activeScopes = scopesOf(relationship);
          const editable = relationship.status === "PENDING" || relationship.status === "ACTIVE";
          return <article className={styles.card} key={relationship.id}>
            <div className={styles.cardHead}>
              <div className={styles.party}>
                <strong>{relationship.agent.displayName ?? relationship.agent.username ?? "Hustle Agent"}</strong>
                <span>@{relationship.agent.username ?? "agent"} · {relationship.agent.location ?? "Location not set"}</span>
              </div>
              <b className={styles.status}>{relationship.status.replaceAll("_", " ")}</b>
            </div>

            <div className={styles.permissionList}>
              {permissionOptions.map((option) => {
                const enabled = activeScopes.includes(option.value);
                return <button
                  type="button"
                  key={option.value}
                  className={enabled ? styles.permissionOn : styles.permissionOff}
                  disabled={!editable || busyId === relationship.id}
                  onClick={() => toggleRelationshipScope(relationship, option.value)}
                >
                  <span>{enabled ? "✓" : "—"}</span>
                  <div><strong>{option.label}</strong><small>{option.detail}</small></div>
                </button>;
              })}
            </div>

            <div className={styles.actions}>
              <span>
                {relationship.status === "PENDING" && "Waiting for Agent acceptance."}
                {relationship.status === "ACTIVE" && "Granted scopes are authoritative, but delegated business tools are not enabled yet."}
                {relationship.status === "DECLINED" && "The Agent declined this invitation."}
                {relationship.status === "REVOKED" && "Authority has been revoked."}
              </span>
              {editable && <button
                type="button"
                className={styles.danger}
                disabled={busyId === relationship.id}
                onClick={() => revoke(relationship)}
              >
                Revoke relationship
              </button>}
            </div>
          </article>;
        })}
      </div>
    </section>}

    <section className={styles.boundary}>
      <strong>Protected by design.</strong>
      <p>
        Agent grants never transfer the Hustler&apos;s identity, ProfessionalProfile ownership,
        Services, Products, wallet, ledger, escrow, payouts, reviews or reputation. Existing
        owner-only business write routes remain owner-only in Phase 18B.
      </p>
    </section>
  </main>;
}
