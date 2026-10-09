# Phase 20 — Notifications Runtime Acceptance

**Current scope:** Phase 20A — persistent in-app inbox and direct-message alerts
**Status:** implementation branch in progress; database activation, CI, deployment and runtime acceptance PENDING.
**Boundary:** Do not mark Phase 20 complete until later source events are integrated and accepted.

## Database gate
- [ ] Apply `20261009130000_phase20a_notification_inbox` to test/staging, verify API role access, RLS, uniqueness and indexes.
- [ ] Approve and apply the migration to the correct production database BEFORE any API deployment using Phase 20A.
- [ ] Do not use a live payment or escrow event as a notification fixture.

## API and messaging
- [ ] Ordinary direct Message creates one persisted alert for the recipient and none for the sender.
- [ ] Agent-assisted direct Message creates recipient alert without transferring principal ownership or Agent audit attribution.
- [ ] Repeated source event cannot create duplicate alerts.
- [ ] Alerts scoped to user; unrelated users cannot list/mark another user's alerts.
- [ ] Read single/all and unread count succeed independently of Message unread state.
- [ ] Stable cursor pagination and invalid-limit/cursor/unauthenticated denial.

## Web
- [ ] `/notifications` loads, persists across refresh, and links to correct `/messages/:conversationId`.
- [ ] Mark-read, mark-all-read, badges and older notifications work.
- [ ] Account/Messages navigation displays route, works on mobile viewport.
- [ ] No external push/SMS/email or unsupported financial/reputation alerts are claimed.

## Release
- [ ] GitHub CI green and PR reviewed/merged.
- [ ] Owner manually deploys API and Web only after migration activation; no automatic deployment.
- [ ] Owner confirms real frontend/runtime test results with date and deployed SHA.
