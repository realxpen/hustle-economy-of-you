# ADR-0050 — Phase 20C1: Meaningful Social Activity Alerts

Status: PR #78 MERGED (`330da33ca24c36d207dc60322608c53ddc7c4fc8`), full Foundation CI passed (`38040547196`) and isolated payment regression passed (`38040547157`) on 2026-10-10. Owner production deployment/manual acceptance deferred to Monday.
Date: 2026-10-10

## Intent

Hustle's notification feed should reconnect people to useful interactions with their work, not manufacture vanity engagement. The approved Phase 20 event set includes new followers and comments. The earlier Phase 20A read model groups repeated direct messages by conversation; apply equivalent anti-spam principles for discussions on a Post.

## Decisions

- On a **new user follow** (unique follower→following pair), notify the followed User once. Do not notify self; do not repeat on upsert or unfollow/refollow, because the durable pair eventKey remains unique. Link to public follower profile when their username exists, otherwise to Activity (avoid inventing a username).
- On a **new Post comment**, notify the Post creator when someone else comments. On a **reply**, also notify the parent comment's author if distinct from the commenter. Deduplicate when creator and parent commenter are the same recipient.
- Use `NotificationKind.SOCIAL` with `social:follow:<followerId>` and `social:comment:<commentId>` event keys. Preserve transaction-unique recipient event mapping and don't put full private comment text in notification bodies.
- Persist the notification in **the same database transaction** as the new follow/comment. Failed/not-owned/invalid Post actions must not create alerts. Existing like/save/unfollow behaviors don't generate noise.
- Social Post notifications are grouped **per recipient + canonical Post path** before cursor pagination. `unread-count` counts discussion groups once even if 10 new comments appear; opening a group's latest card marks only prior matching events read, leaving new arrivals unread.
- Different Posts never merge. Social follow notifications are **not** grouped with comment notifications or each other. MESSAGE grouping, Booking/Order independent notification cards, auth scoping and API-only RLS remain unchanged.
- Existing Notification table, enum, indexes and per-recipient uniqueness suffice. **No database migration**; existing production social event history remains unchanged.

## Risks and constraints

- Prior ignored past follows/comments are not retroactively backfilled.
- Idempotence guards repeated follows and duplicate notification delivery; two deliberately separate new comments are distinct durable events, displayed together in the same discussion card.
- The `messageCount` and `unreadMessages` response fields describe group-event counts even for social events; renaming them would require a versioned API change and is deferred.
- The historical owner-visible public Post page provides safe deep linking for creator and reply participants; no access to a hidden/draft Post is inferred from notifications. A Post archived afterward may no longer be openable; authorization remains on destination.

## Deferred Phase 20C2/C3

Application status and verification notices, transaction-backed review notice, and a followed Hustler going LIVE still require implementation. They are **not** claimed complete by this PR.

## Monday consolidated acceptance

- [ ] On initial follow A→B, only B gets a new follower alert. Repeating follow does not send another.
- [ ] A unfollows/refollows B: no new notification spam.
- [ ] A comments on B's published Post: B gets one alert with Post link; A receives none.
- [ ] A replies to C's comment on B's Post: B and C receive one alert each, unless B/C are the same User.
- [ ] Five comments on same Post: one grouped discussion card + one unread group, actual comments retained individually.
- [ ] Comments on two Posts: separate groups. Message/Booking/Order groups unaffected.
- [ ] Opening a discussion group marks only historical events in the same Post read; later comment makes it unread.
- [ ] Deleting/rejecting invalid Post action doesn't leave a ghost alert; cross-account mark read/recipient data access denied.
- [ ] CI green, owner-controlled API + Web releases and runtime review after weekend build.
