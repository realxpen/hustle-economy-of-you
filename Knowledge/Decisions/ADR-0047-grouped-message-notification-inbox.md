# ADR-0047 — Group Direct Message Notifications by Conversation

Status: PR #73 MERGED, full GitHub CI passed 2026-10-09; manual API/Web deployment and owner runtime acceptance pending.
Date: 2026-10-09

## Observation

Phase 20A initially persisted one notification event per incoming Message. The owner tested the live inbox and noticed repeated short Messages in the same chat produced multiple notification cards, even though they represent one actionable conversation.

The intended experience is **one conversation card**, showing "3 new messages" for three unread messages, while retaining all three original Message records.

## Decision

**Group at the authenticated API read-model boundary, not by mutating historical events.**

- Existing `Notification` rows remain individually durable and idempotent through `(recipientUserId,eventKey)`. No raw events or Messages are deleted, edited or backfilled.
- MESSAGE notifications are grouped by **recipient identity + internal direct-conversation href**. Every other kind remains independent. Different conversations never merge, even when sender identity or wording matches.
- Grouping is executed **before** cursor pagination, so one busy thread does not generate several cards across pages.
- The card represents the latest event and includes a `messageCount` (total events in that group) and `unreadMessages` (events not yet read).
- The server unread-count API counts **unread notification groups**, not individual MESSAGE events.
- Opening a MESSAGE card marks all earlier, unread notifications for *that recipient and conversation* as read, capped at the card's latest event ordering. Messages arriving afterward remain unread.
- Mark-all remains recipient-scoped and leaves actual conversation/message read receipts untouched.
- Presentation: one card per conversation; "N new messages" when multiple unread events; after reading, "N messages in this conversation". Avoid exposing private message previews in notification cards.
- The server derives the recipient from its verified authentication identity; the client cannot request another user's grouped messages or mark their alerts.
- No database migration, new table, query-param trust, external push, notification transport, or payment/reputation mutation is required.

## Operational notes

The groups are computed from authoritative Notification records. This also *visually consolidates existing alerts*, without destroying event history. At MVP scale, the server performs recipient-scoped aggregate reads. If event volume grows, a transactionally maintained inbox projection can replace the query without changing the user-facing contract.

The REST endpoints remain:
- `GET /notifications`: now returns `messageCount` and `unreadMessages` on items.
- `GET /notifications/unread-count`: counts groups.
- `POST /notifications/:id/read`: marks the selected conversation group up to the selected item, other kinds only themselves.
- `POST /notifications/read-all`: unchanged behavior.

## Verification

- [ ] Three incoming messages in one direct thread display exactly one card with "3 new messages"; underlying message history remains three individual messages.
- [ ] Two separate direct threads display two cards, not one; one unrelated activity kind is independent.
- [ ] Opening the grouped card marks its prior alerts read without marking a newly arrived message read.
- [ ] Unread count represents conversations/independent notification groups rather than message volume.
- [ ] Previously created notification rows visually group after deployment, no data deletion.
- [ ] Grouping occurs before pagination and load-more never duplicates groups in a stable dataset.
- [ ] API recipient isolation, unauthenticated denial, and no external push/financial side effects remain intact.
- [ ] Web/API types and production builds pass.

PR #73 merge: `ba70e5a7ab1ca8c3e4b42debffe7dbcd94747540`. The source query was exercised read-only against Hustle's existing production notification events and showed multiple events from one conversation as one group. GitHub CI passed Web/Admin/Mobile/API typechecks and Web/Admin/API production builds. The change needs no database migration. API/Web Vercel production remained at the pre-fix `980352e` when checked; no deployment was triggered.

CI and API behavior are separate from owner-reported production acceptance. Owner controls Vercel releases.
