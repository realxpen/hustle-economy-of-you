"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ExperienceHeader } from "../../components/navigation/experience-header";
import { ExperienceState } from "../../components/experience/experience-state";
import { adaptiveClient, type AdaptiveBlueprint, type AdaptiveInvitation, type AdaptiveMembership, type AdaptiveServiceDraft, type AdaptiveWorkItem } from "../../lib/adaptive";
import styles from "./page.module.css";
import { AdaptivePolicyForm } from "../../components/economy/adaptive-policy-form";
import type { AdaptivePolicy } from "../../lib/adaptive";

type Tab = "Overview" | "Services" | "Work" | "Team";
const tabs: Tab[] = ["Overview", "Services", "Work", "Team"];
const scopes = [
  ["services.manage","Edit services"],["work.manage","Manage work"],
  ["schedule.manage","Scheduling"],["messages.reply","Reply to clients"],
  ["finance.view","View summaries"]
] as const;
const money = (amount: number) => new Intl.NumberFormat("en-NG", {
  style: "currency", currency: "NGN", maximumFractionDigits: 2
}).format(amount / 100);
const message = (value: unknown) => value instanceof Error ? value.message : "Something went wrong. Try again.";

export default function EconomyPage() {
  const [tab, setTab] = useState<Tab>("Overview");
  const [spaces, setSpaces] = useState<AdaptiveMembership[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [blueprints, setBlueprints] = useState<AdaptiveBlueprint[]>([]);
  const [serviceDrafts, setServiceDrafts] = useState<AdaptiveServiceDraft[]>([]);
  const [work, setWork] = useState<AdaptiveWorkItem[]>([]);
  const [members, setMembers] = useState<Awaited<ReturnType<typeof adaptiveClient.members>>>([]);
  const [invites, setInvites] = useState<AdaptiveInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [unavailable, setUnavailable] = useState(false);
  const [newBusiness, setNewBusiness] = useState({ name: "", kind: "BUSINESS", category: "" });
  const [newService, setNewService] = useState<{title: string; blueprint: string; price: string; policy: AdaptivePolicy; editingId: string | null; expectedRevision: number}>({ title: "", blueprint: "appointment", price: "", policy: {}, editingId: null, expectedRevision: 1 });
  const [newWork, setNewWork] = useState({ title: "", description: "" });
  const [newInvite, setNewInvite] = useState({ username: "", role: "ASSISTANT", permissions: ["work.manage","messages.reply"] });

  const load = useCallback(async () => {
    try {
      const [memberships, templates, requests] = await Promise.all([
        adaptiveClient.workspaces(), adaptiveClient.blueprints(), adaptiveClient.invitations()
      ]);
      setSpaces(memberships); setBlueprints(templates); setInvites(requests);
      setNewService(current => Object.keys(current.policy).length ? current :
        { ...current, policy: templates.find(t => t.slug === current.blueprint)?.defaults ?? {} });
      setSelected(prev => memberships.some(x => x.workspace.id === prev) ?
        prev : (memberships.find(x => x.workspace.kind === "PERSONAL")?.workspace.id ?? memberships[0]?.workspace.id ?? ""));
      setError(""); setUnavailable(false);
    } catch (reason) {
      setError(message(reason));
      // No fallback to browser memory or invented account data.
      setUnavailable(true);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!selected || unavailable) { setServiceDrafts([]);setMembers([]);return; }
    let active = true;
    void Promise.all([adaptiveClient.services(selected), adaptiveClient.work(selected), adaptiveClient.members(selected)])
      .then(([services, records, people]) => {
        if (!active) return;
        setServiceDrafts(services);setWork(records.items);setMembers(people);
      })
      .catch(reason => { if (active) setError(message(reason)); });
    return () => { active = false; };
  }, [selected, unavailable]);

  const active = spaces.find(x => x.workspace.id === selected);
  const owner = active?.role === "OWNER";

  async function mutate(action: () => Promise<unknown>, done: string, refresh = true) {
    if (busy) return;
    setBusy(true);setNotice("");setError("");
    try {
      await action();
      setNotice(done);
      if (refresh) {
        await load();
        if (selected) {
          const [services, records, people] = await Promise.all([
            adaptiveClient.services(selected), adaptiveClient.work(selected), adaptiveClient.members(selected)
          ]);
          setServiceDrafts(services);setWork(records.items);setMembers(people);
        }
      }
    } catch (reason) { setError(message(reason)); }
    finally { setBusy(false); }
  }
  function submit(event: FormEvent<HTMLFormElement>, callback: () => void) {
    event.preventDefault();
    callback();
  }

  if (loading) return <main className={styles.page}>
    <ExperienceHeader section="You" />
    <ExperienceState kind="loading" title="Opening your Economy…" />
  </main>;

  return <main className={styles.page}>
    <ExperienceHeader section="You" secondaryLinks={[{ href: "/account", label: "← Your profile" }]} />
    <section className={styles.hero}>
      <small>HUSTLE · YOUR ECONOMY</small>
      <h1>One identity. Many ways to work.</h1>
      <p>Keep personal work, businesses, services and trusted collaborators organized around the same Hustle account.</p>
    </section>
    <p className={styles.safety}>Development feature · Real authenticated records only when the Adaptive Core backend and migration are enabled. No payment, public listing or messaging is created here.</p>
    {error && <div className={styles.error} role="alert">{error}
      {unavailable && <p>The Adaptive Core backend is disabled or inaccessible in this environment. Existing bookings, orders and account features are unchanged.</p>}
    </div>}
    {notice && <p className={styles.notice} role="status">{notice}</p>}
    {unavailable ? <div className={styles.empty}>
      <h2>Backend activation is still gated</h2>
      <p>This screen will read authenticated data once the isolated development database has the reviewed migration and feature switch. It will not display fictional records in the meantime.</p>
      <button type="button" onClick={() => { setLoading(true);void load(); }}>Try again</button>
      <Link href="/account">Return to your profile</Link>
    </div> : <>
      {!spaces.length ? <div className={styles.empty}>
        <h2>Activate your personal workspace</h2>
        <p>This preserves your existing Hustle account and gives your future businesses separate work records.</p>
        <button disabled={busy} onClick={() => void mutate(() => adaptiveClient.provisionPersonal(), "Personal workspace created.")}>Create personal workspace</button>
      </div> : <>
        <div className={styles.context}>
          <label htmlFor="economy-space">WORKING AS</label>
          <select id="economy-space" value={selected} onChange={e => setSelected(e.target.value)}>
            {spaces.map(x => <option key={x.workspace.id} value={x.workspace.id}>{x.workspace.name} · {x.workspace.kind.toLowerCase()}</option>)}
          </select>
          <span>{active?.role.toLowerCase()} permissions · {active?.workspace.category || "Hustle"}</span>
        </div>
        <nav className={styles.tabs} aria-label="My Economy sections">
          {tabs.map(x => <button key={x} type="button" className={tab === x ? styles.active : ""}
            aria-current={tab === x ? "page" : undefined} onClick={() => setTab(x)}>{x}</button>)}
        </nav>
        {tab === "Overview" && <>
          <section className={styles.card}>
            <div className={styles.sectionHead}><h2>Your workspaces</h2><small>{spaces.length} active</small></div>
            {spaces.map(x => <button key={x.workspace.id} className={styles.workspace}
              type="button" onClick={() => setSelected(x.workspace.id)}>
              <strong>{x.workspace.name}</strong><span>{x.workspace.kind} · {x.role}</span><b aria-hidden="true">{selected === x.workspace.id ? "✓" : "→"}</b>
            </button>)}
          </section>
          <section className={styles.card}>
            <h2>Create another business or team</h2>
            <p className={styles.help}>Each workspace has its own authorized members, services and work records. No new sign-in is required.</p>
            <form className={styles.form} onSubmit={e => submit(e, () => void mutate(() =>
              adaptiveClient.createWorkspace(newBusiness.name, newBusiness.kind, newBusiness.category), "Business workspace created."))}>
              <label>Business name<input required minLength={3} maxLength={90} value={newBusiness.name}
                onChange={e => setNewBusiness({ ...newBusiness, name: e.target.value })} placeholder="e.g. Kunle Cuts" /></label>
              <label>Workspace type<select value={newBusiness.kind} onChange={e => setNewBusiness({ ...newBusiness, kind: e.target.value })}>
                <option value="BUSINESS">Business</option><option value="TEAM">Team</option><option value="AGENCY">Agency</option>
              </select></label>
              <label>Category<input minLength={2} value={newBusiness.category}
                onChange={e => setNewBusiness({ ...newBusiness, category: e.target.value })} placeholder="Fashion, grooming…" /></label>
              <button type="submit" disabled={busy || newBusiness.name.trim().length < 3}>Create workspace</button>
            </form>
          </section>
        </>}
        {tab === "Services" && <>
          <section className={styles.card}>
            <h2>{newService.editingId ? "Edit private service draft" : "Configure a service"}</h2>
            <p className={styles.help}>Set the right workflow for appointments, laundry, tailoring, events, training or digital work. Drafts remain private; these settings are not live availability or customer booking rules yet.</p>
            <form className={styles.form} onSubmit={e => submit(e, () => void mutate(async () => {
              const priceMinor = Math.round(Number(newService.price) * 100);
              const policy = Object.keys(newService.policy).length ? newService.policy :
                (blueprints.find(b => b.slug === newService.blueprint)?.defaults ?? {});
              if (newService.editingId)
                await adaptiveClient.updateService(selected, newService.editingId, { title: newService.title, priceMinor, policy, expectedRevision: newService.expectedRevision });
              else
                await adaptiveClient.createService(selected, { title: newService.title, blueprint: newService.blueprint, priceMinor, policy });
              setNewService({ title: "", blueprint: "appointment", price: "", policy: blueprints.find(b => b.slug === "appointment")?.defaults ?? {}, editingId: null, expectedRevision: 1 });
            }, newService.editingId ? "Service draft updated." : "Service draft saved."))}>
              <label>Service title<input required minLength={3} maxLength={150} value={newService.title}
                onChange={e => setNewService({ ...newService, title: e.target.value })} placeholder="What do you offer?" /></label>
              <label>Journey type<select value={newService.blueprint} disabled={!!newService.editingId}
                onChange={e => { const blueprint = e.target.value; setNewService({
                  ...newService, blueprint, policy: blueprints.find(b => b.slug === blueprint)?.defaults ?? {}
                }); }}>
                {blueprints.map(b => <option key={b.slug} value={b.slug}>{b.label}</option>)}
              </select></label>
              <label>Starting price (₦)<input type="number" min={0} step=".01" required value={newService.price}
                onChange={e => setNewService({ ...newService, price: e.target.value })} /></label>
              <AdaptivePolicyForm blueprint={newService.blueprint}
                policy={Object.keys(newService.policy).length ? newService.policy :
                  (blueprints.find(b => b.slug === newService.blueprint)?.defaults ?? {})}
                onChange={policy => setNewService({ ...newService, policy })} disabled={busy} />
              <button type="submit" disabled={busy || !(owner || active?.permissions.includes("services.manage"))}>
                {newService.editingId ? "Save revised draft" : "Save private service draft"}
              </button>
              {newService.editingId && <button type="button" className={styles.secondary} onClick={() =>
                setNewService({ title: "", blueprint: "appointment", price: "", policy: blueprints.find(b => b.slug === "appointment")?.defaults ?? {}, editingId: null, expectedRevision: 1 })
              }>Cancel editing</button>}
            </form>
          </section>
          <section className={styles.card}><div className={styles.sectionHead}><h2>Service drafts</h2><small>{serviceDrafts.length}</small></div>
            {!serviceDrafts.length && <p className={styles.help}>No drafts in this workspace yet.</p>}
            {serviceDrafts.map(s => <article key={s.id} className={styles.item}>
              <strong>{s.title}</strong>
              <small>{s.blueprint.slug} v{s.blueprint.version} · revision {s.revision} · {money(s.priceMinor)} · private draft</small>
              <small>Configuration: {Object.keys(s.policy ?? {}).length} workflow options</small>
              <button type="button" className={styles.secondary} disabled={busy || !(owner || active?.permissions.includes("services.manage"))}
                onClick={() => {
                  setNewService({ title: s.title, blueprint: s.blueprint.slug, price: (s.priceMinor / 100).toFixed(2),
                    policy: s.policy ?? {}, editingId: s.id, expectedRevision: s.revision });
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}>Edit this draft</button>
            </article>)}
          </section>
        </>}
        {tab === "Work" && <>
          <section className={styles.card}>
            <h2>One hub for existing work</h2>
            <p className={styles.help}>Bookings and product orders below come from their real existing records. They can only be changed through their original protected workflows.</p>
            <button type="button" className={styles.secondary} disabled={busy} onClick={() => void mutate(async () => {}, "Work list refreshed.")}>Refresh work</button>
            {!work.length && <p className={styles.help}>No work records in this workspace yet.</p>}
            {work.map(w => <article key={w.id} className={styles.item}>
              <div className={styles.itemHead}><small>{w.source.replaceAll("_"," ")}</small><span>{w.status.replaceAll("_"," ")}</span></div>
              <strong>{w.title}</strong>
              <small>{w.amountMinor != null ? money(w.amountMinor) + " · " : ""}{new Date(w.updatedAt).toLocaleDateString("en-NG")}</small>
              {w.canonicalPath && <Link href={w.canonicalPath}>Open original {w.source.toLowerCase()} →</Link>}
              {w.source === "ADAPTIVE_DRAFT" && <span>Draft only · No booking or payment created</span>}
            </article>)}
          </section>
          <section className={styles.card}>
            <h2>Private work draft</h2>
            <form className={styles.form} onSubmit={e => submit(e, () => void mutate(() =>
              adaptiveClient.createWorkDraft(selected, newWork.title, newWork.description), "Private work draft saved."))}>
              <label>Work title<input required minLength={3} value={newWork.title} onChange={e => setNewWork({ ...newWork, title: e.target.value })}/></label>
              <label>What needs doing?<textarea maxLength={2000} value={newWork.description} onChange={e => setNewWork({ ...newWork, description: e.target.value })}/></label>
              <button type="submit" disabled={busy || !(owner || active?.permissions.includes("work.manage"))}>Create private draft</button>
            </form>
          </section>
        </>}
        {tab === "Team" && <>
          <section className={styles.card}><h2>Current members</h2>
            {members.map(m => <article key={m.id} className={styles.item}>
              <strong>{m.user.displayName || m.user.username || "Hustle member"}</strong>
              <small>{m.role} · {m.status} · {m.permissions.length ? m.permissions.join(", ") : "owner access"}</small>
            </article>)}
            {!members.length && <p className={styles.help}>No members visible.</p>}
          </section>
          <section className={styles.card}>
            <h2>Invite with explicit consent</h2>
            <p className={styles.help}>The recipient must sign in and accept. Invitations cannot grant withdrawals, payout changes, escrow release or owner privileges.</p>
            <form className={styles.form} onSubmit={e => submit(e, () => void mutate(() =>
              adaptiveClient.invite(selected,newInvite.username,newInvite.role,newInvite.permissions), "Invitation recorded. Awaiting the user's acceptance."))}>
              <label>Existing Hustle username<input required value={newInvite.username}
                onChange={e => setNewInvite({ ...newInvite, username: e.target.value })} /></label>
              <label>Team role<select value={newInvite.role} onChange={e => setNewInvite({ ...newInvite, role: e.target.value })}>
                {["ASSISTANT","WORKER","MANAGER","AGENT","ACCOUNTANT"].map(role => <option key={role}>{role}</option>)}
              </select></label>
              <fieldset className={styles.scopes}><legend>Allowed actions</legend>
                {scopes.map(([scope,label]) => <label key={scope}><input type="checkbox"
                  checked={newInvite.permissions.includes(scope)}
                  onChange={e => setNewInvite({ ...newInvite, permissions: e.target.checked ?
                    [...newInvite.permissions,scope] : newInvite.permissions.filter(x => x !== scope) })} />{label}</label>)}
              </fieldset>
              <button type="submit" disabled={busy || !owner || newInvite.permissions.length === 0}>Invite with selected access</button>
            </form>
          </section>
          {!!invites.length && <section className={styles.card}><h2>Invitations for you</h2>
            {invites.map(x => <article key={x.id} className={styles.item}><strong>{x.workspace.name}</strong><small>{x.role} · {x.permissions.join(", ")}</small>
              <div className={styles.inviteActions}>
                <button disabled={busy} onClick={() => void mutate(() => adaptiveClient.respond(x.id,"accept"), "Invitation accepted.")}>Accept</button>
                <button disabled={busy} onClick={() => void mutate(() => adaptiveClient.respond(x.id,"decline"), "Invitation declined.")}>Decline</button>
              </div>
            </article>)}
          </section>}
        </>}
      </>}
    </>}
  </main>;
}
