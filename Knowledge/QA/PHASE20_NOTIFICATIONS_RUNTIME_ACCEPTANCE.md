# Phase 20 — Notifications Runtime Acceptance

**Current scope:** Phase 20A — persistent in-app inbox and direct-message alerts
**Status:** PR #72 merged CI green; production notification migration applied/verified 2026-10-09; production API and Web Vercel deployments independently verified READY on Phase20A commit `980352e`. Actual API/Web runtime acceptance PENDING.
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

**Observation:** Owner confirmed normal message notification flow worked but repeated messages in the same conversation showed separate inbox cards. Grouping correction merged status and deployment acceptance are tracked separately.

- [ ] Three unread messages from one person/conversation display **one notification card**, e.g. "3 new messages"; original Messages stay separate in the conversation.
- [ ] Existing historical notification cards also consolidate without deleting notification rows.
- [ ] Two separate conversations display separate cards; non-message notifications stay independent.
- [ ] Unread badge counts attention-worthy **groups** (one thread with three unread messages counts once).
- [ ] Opening a thread notification marks that group read only; unrelated threads stay unread.
- [ ] A message arriving after the selected card remains unread; new activity reactivates the group.
- [ ] Page 1/Load older shows distinct groups (no split of one thread across pages).
- [ ] Unauthorized access and cross-user mark-read are denied; no notification database migration.
- [ ] API/Web builds and runtime acceptance passed after owner-controlled deployment.

**Preflight:** A read-only production grouping query on 2026-10-09 verified that two existing notification events from one conversation formed one group. This is database query validation only, **not** production app acceptance.

## Release
- [x] GitHub CI green and PR #72 merged as `ea142411fda852931fd7bfdc0b5bffcc31ca0868`.
- [x] API and Web projects already have production READY deployments at Phase20A-inclusive commit `980352e` (verified independently via Vercel), with migration now present. These deployments predated completion of migration verification; ChatGPT did not deploy or initiate them. Verify alias routing and real message notification behavior in runtime.
- [ ] Owner confirms real frontend/runtime test results with date and deployed SHA.
