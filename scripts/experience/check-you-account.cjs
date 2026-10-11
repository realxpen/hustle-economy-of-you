#!/usr/bin/env node
// You/account static design + trust/privacy authority contract.
// Does not impersonate or read a real account. Authenticated device QA remains separate.
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const read=(p)=>fs.readFileSync(path.join(__dirname,"../..",p),"utf8");
const page=read("apps/web/app/account/page.tsx");
const layout=read("apps/web/app/account/page.module.css");
const trust=read("apps/web/components/trust/trust-activity-center.module.css");
const reputation=read("apps/web/components/trust/reputation-surfaces.module.css");
const statements=[
 [page.includes('section="You"'),"Uses cohesive ExperienceHeader"],
 [page.includes('"h-adaptive"'),"Supports light/dark/system design tokens"],
 [page.includes('getMyAccount({ force: refreshVersion > 0 })'),"Account retry fetches authoritative profile"],
 [page.includes('Contact verification pending'),"Does not claim contact verified without evidence"],
 [page.includes('contactVerified ? "✓ Contact verified"'),"Uses API-verified contact for scoped trust"],
 [page.includes('account.capabilities.map'),"Capabilities are drawn from server status"],
 [page.includes('entry.status === "ACTIVE"'),"Capability activation is checked from API"],
 [page.includes('hustlerActive && <>'),"Hustler tools gated by actual capability"],
 [page.includes('agentActive ? "/agent-workspace"'),"Agent workspace gated by actual capability"],
 [page.includes('href="/bookings"'),"Bookings access"],
 [page.includes('href="/orders"'),"Orders access"],
 [page.includes('href="/messages"'),"Messages access"],
 [page.includes('href="/wallet"'),"Wallet access"],
 [page.includes('href="/onboarding"'),"Real profile editing"],
 [page.includes('onToggle={(event) => setPrivacyOpen'),"Privacy expands on demand"],
 [page.includes('privacyOpen && <div'),"Optional analytics consent UI retained"],
 [page.includes('trustOpen && <div'),"Real trust activity retained"],
 [page.includes('const { error: authError } = await'),"Sign out errors are handled"],
 [!page.includes('className="futureTag"'),"Legacy tag cloud removed"],
 [layout.includes('@media(max-width:500px)'),"Small phone screen design"],
 [layout.includes('grid-template-columns:repeat(2,minmax(0,1fr))'),"Compact responsive action tiles"],
 [trust.includes('var(--h-ink'),"Trust light/dark ink contrast"],
 [trust.includes('var(--h-muted'),"Trust secondary labels legible"],
 [reputation.includes('var(--h-surface'),"Review cards use adaptive background"],
];
for(const [ok,label] of statements) assert.ok(ok,label);
console.log("You account UX source contract OK ("+statements.length+" checks).");
