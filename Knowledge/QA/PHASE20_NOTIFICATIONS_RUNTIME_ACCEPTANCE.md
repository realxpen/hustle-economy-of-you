# Phase 20 — Notifications Runtime Acceptance

**Current scope:** Phase 20A — persistent in-app inbox and direct-message alerts
**Status:** Phase 20A direct-message notifications and grouped conversation display passed owner production smoke test 2026-10-09; PR #73 grouped fix deployed on API/Web commit `7b5c10d`, both READY. Deeper authorization, concurrency, and pagination acceptance tests remain pending. Phase 20B+ events not built/accepted.
**Boundary:** Do not mark Phase 20 complete until later source events are integrated and accepted.

## Database gate
- [ ] Isolated test/staging database run NOT performed — no existing branch; do not claim it passed. Preflight schema compatibility was inspected read-only, and production post-migration schema/index/RLS/privileges were verified.
- [x] Owner approved and migration `phase20a_notification_inbox` applied to verified production Supabase project `pfgarmyygybmhiiuopym` on 2026-10-09 (Supabase migration version `20261009123129`). Verified table, 9 columns, enum, FK, 4 indexes, 3 API-only RLS policies, role privileges, zero initial rows.
- [ ] Do not use a live payment or escrow event as a notification fixture.

## API and messaging
- [x] Ordinary direct Message creates one persisted alert for the recipient and none for the sender. Owner confirmed Phase 20A first-pass manual testing 2026-10-09 before grouping fix (repeated messages correctly produced separate underlying alerts).
- [ ] Agent-assisted direct Message creates recipient alert without transferring principal ownership or Agent audit attribution.
- [ ] Repeated source event cannot create duplicate alerts.
- [ ] Alerts scoped to user; unrelated users cannot list/mark another user's alerts.
- [ ] Read single/all and unread count succeed independently of Message unread state.
- [ ] Stable cursor pagination and invalid-limit/cursor/unauthenticated denial.

## Web
- [x] `/notifications` loads, persists across refresh, and links to correct `/messages/:conversationId` (owner-confirmed initial Phase 20A smoke test, 2026-10-09).
- [ ] Mark-read, mark-all-read, badges and older notifications work.
- [ ] Account/Messages navigation displays route, works on mobile viewport.
- [ ] No external push/SMS/email or unsupported financial/reputation alerts are claimed.

## Grouping correction — ADR-0047

**Observation:** Owner confirmed the new PR #73 grouping fix is live on 2026-10-09. Vercel reports production API and Web READY on commit `7b5c10d`. Owner screenshot on `/notifications` shows one card labelled **5 new messages** and a badge labelled **1 unread**; owner says updated features work. This confirms grouping and group unread badge, not the entire independent regression checklist.

- [x] Multiple unread messages from one conversation display **one notification card**; screenshot captured **5 new messages** in one card on 2026-10-09. Original individual message history was not independently inspected during this screenshot.
- [ ] Existing historical notification cards also consolidate without deleting notification rows.
- [ ] Two separate conversations display separate cards; non-message notifications stay independent.
- [x] Unread badge counts attention-worthy **groups** (screenshot shows **1 unread** with **5 new messages** in one group).
- [ ] Opening a thread notification marks that group read only; unrelated threads stay unread.
- [ ] A message arriving after the selected card remains unread; new activity reactivates the group.
- [ ] Page 1/Load older shows distinct groups (no split of one thread across pages).
- [ ] Unauthorized access and cross-user mark-read are denied; no notification database migration.
- [x] API/Web builds passed CI, both owner-updated production deployments READY at `7b5c10d`, and basic grouped-card runtime smoke test passed; remaining in-depth grouping edge cases listed above still pending.

**Preflight:** A read-only production grouping query on 2026-10-09 verified that two existing notification events from one conversation formed one group. This is database query validation only, **not** production app acceptance.

## Release
- [x] GitHub CI green and PR #72 merged as `ea142411fda852931fd7bfdc0b5bffcc31ca0868`.
- [x] API and Web projects already have production READY deployments at Phase20A-inclusive commit `980352e` (verified independently via Vercel), with migration now present. These deployments predated completion of migration verification; ChatGPT did not deploy or initiate them. Verify alias routing and real message notification behavior in runtime.
- [x] Owner confirms working grouped-message production frontend and supplies screenshot on 2026-10-09; deployments API/Web at `7b5c10d`. This is a feature smoke test, not full Phase 20 completion.
