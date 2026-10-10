# ADR-0057 — UX-004: Final MVP experience refinement

Date: 2026-10-10
Status: Candidate code on `feat/ux004-mvp-experience-refinement`; requires final CI success and merge verification. Manual deployment and Monday October 12 runtime acceptance pending.

## Context
UX-001/002/003 established mobile-first tokens, shared chrome, canonical commerce statuses and async recovery. Important Messaging, Activity, Wallet, content creation, Live and Agent screens still used older patterns, opaque money states or stale implementation-phase labels.

## Decision
- **Messaging/Activity:** Reuse ExperienceHeader and ExperienceState where appropriate. Inbox search/unread filter operates on currently fetched conversations only; chat retains canonical sender, private attachment, read/typing and delegated-message provenance. Selected files remain participant-protected; keyboard send shortcut, composer safe-area behavior and more accessible attach control add no new transport. Activity filter is client-side on fetched notification groups and does not change API grouping, pagination or read authority.
- **Wallet:** Keep all amounts ledger-derived and currencies separate. Available versus pending, escrow and withdrawal-reserved balances have explicit explanations. Prevent obviously over-available withdrawal requests in the UI, while preserving server-side authority, idempotency and provider status. Financial reconciliation does not report invented zero/healthy values when no read succeeds. Retry is read-only and payments are unchanged.
- **Live and content:** Preserve native broadcast and optional external playback. Show retryable discovery states, avoid claiming zero broadcasts during loading/errors, explain room creation is not broadcast activation. Remove developer-phase copy; prefer Hustle action orange in Live; publishing separates draft completeness from actual publication and adds media previews, progress feedback and accessible labels. No new media transport or unverified reputation.
- **Agent:** Workspace sections and scoped permissions are clearer, unavailable-account states offer safe recovery, assisted scope controls expose pressed state, and agent-owned records never become the principal's authority. Represented workspace clears old principal data when the principal route changes before API reauthorization; server permission checks remain binding.

## Safety boundaries
No API, Postgres, Prisma, finance services, webhook, escrow, permission-grant, Agent actor/provenance, notification producer, or hosted deployment changes. No automatic Vercel deployment, production migrations, real payouts or payments. Preview/build CI is not manual phone and transactional acceptance.

## Next
Foundation CI Web/Admin/Mobile/API typecheck and build on final PR SHA. After code/CI merge, proceed to MVP stabilization and the consolidated owner-controlled October 12 browser/device and isolated sandbox review before any release claim.
