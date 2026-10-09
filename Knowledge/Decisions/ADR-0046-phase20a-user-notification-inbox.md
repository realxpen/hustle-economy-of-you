# ADR-0046 — Phase 20A User Notification Inbox

Status: Implementation merged; production database active and verified 2026-10-09; API/Web deployment and runtime acceptance pending
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

### Database activation record — 2026-10-09
Project owner approved the migration in the development conversation. Verified the production project against the live Web Supabase URL and the project API: `pfgarmyygybmhiiuopym` (`hustle-economy of you`). The in-repo migration source was applied with the Supabase migration authority under `phase20a_notification_inbox`; Supabase recorded migration version `20261009123129`.

Post-apply read-only checks confirmed 9 Notification columns, NotificationKind enum, User foreign key, 4 indexes including `(recipientUserId,eventKey)` uniqueness, RLS ON, three hustle_api-only policies and SELECT/INSERT/UPDATE role permissions with no DELETE. `anon` and `authenticated` have no SELECT. Initial notification count was zero. Security advisor had no Notification-specific warnings; the performance advisor flagged the new indexes as unused (expected before production traffic), in addition to existing unrelated project advisories. No data-creating test messages or production payment tests were run.

An existing staging branch and local PostgreSQL server were not available. Therefore, we performed schema/role/RLS compatibility preflight and production post-migration validation, **not** a separate staging execution. This must not be misrepresented as staging acceptance. Owner controls release; API/Web deployment and runtime validation remain pending.

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
