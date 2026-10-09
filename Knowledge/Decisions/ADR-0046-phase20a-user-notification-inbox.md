# ADR-0046 — Phase 20A User Notification Inbox

Status: Accepted for implementation; database activation and runtime acceptance pending
Date: 2026-10-09

## Context
Hustle already has authoritative Messages, Booking/Order state, capability application status, Live, enforcement events and SystemEvents, but no durable end-user notification inbox. The approved phase plan specifies useful alerts, not vanity engagement spam.

## Decision
Phase 20A introduces a durable server-authoritative `Notification` with:
- `recipientUserId`: the existing unified Hustle User (Client, Hustler and Agent are capabilities);
- `kind`, `eventKey`, `title`, `body`, safe internal `href`, `createdAt`, and nullable `readAt`;
- a unique `(recipientUserId, eventKey)` for at-most-one persisted alert per source action, even on retried writes;
- strict user-scoped API reads/mark-read operations with no public create/delete endpoint;
- stable cursor pagination, unread counts, mark-one-read, mark-all-read;
- RLS enabled and SELECT/INSERT/UPDATE granted only to the `hustle_api` database role.

### First authoritative event: messages
Creating an ordinary or Agent-assisted direct Message atomically creates the recipient notification in the *same Prisma transaction*. The sender receives no self-notification. Agent-assisted messages remain authored by the principal and audited as Agent-delegated. The notice itself never reveals a message preview in the inbox listing.

### UX
- `/notifications` in Hustle Web: unread badge, newest-first activity feed, mark-read on open, mark all read, links into context, empty state, pagination;
- Account and Messages navigation provide entry points;
- Direct-message routes are internal path URLs, never external redirect destinations.

### Deliberate limitations
- Phase 20A is in-app only. No email, SMS, WhatsApp, OS push, device tokens, campaign broadcast, engagement spam, or scheduled jobs.
- No fabricated financial alerts: Booking/Order/payment alerts will be added only at their authoritative transitions in follow-on Phase 20 slices.
- No replacement of conversation's own unread state: notification read receipts do not mutate Message or ConversationParticipant read state.
- Future notification policies/preferences, digesting, rate limits, event aggregation, moderation of push and retry/outbox semantics require their own design before external delivery.
- The browser is not trusted to choose recipients or forge notifications.

## Database and release gate
Migration: `20261009130000_phase20a_notification_inbox`. Apply and verify on a non-production/test database first, then with owner approval on the designated Supabase production database **before deploying API**. Do not write notification-producing messages while the API code expects a missing table.

## Acceptance checks
1. User A sends a direct message to User B. Only B gets one MESSAGE alert, with safe link to the actual thread; A gets none.
2. An active Agent sends a delegated message for a principal. The other conversation member receives the alert; principal ownership and the Agent's message-audit attribution remain unchanged.
3. Reload: alerts persist and are scoped to signed-in user; an unrelated User C cannot query or mark B's alerts as read.
4. Mark one read then mark all read; unread counts match and Message unread indicators do not change.
5. Pagination is ordered/has no duplicates, invalid cursor and out-of-range limits fail, unauthorized requests fail.
6. Repeat the same notification source event: unique event key prevents duplicates.
7. No delivery to external devices/channels and no payment, escrow, payout or reputation mutation.
8. Browser inbox works on mobile screen widths; navigation opens real message context.
9. CI typechecks/builds pass; schema migration verified separately.

Runtime acceptance must not be inferred from CI. API and Web are owner-controlled manual deployments only.
