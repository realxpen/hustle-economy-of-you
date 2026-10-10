# ADR-0052 — Phase 20C3: Live-start and Verified Review Activity

Status: MERGED PR #80 (`f78f9e6919a69ada5c267681ea3edc32af281b7e`); Foundation CI `38041849418` and isolated Live/Review/financial integration CI `38041849387` PASSED 2026-10-10; manual Monday acceptance and owner deployment pending
Date: 2026-10-10

## Meaningful events

A host going LIVE is useful to followers who want to watch demonstrated craft and attached Services/Products. A transaction-backed verified Review is important to the professional or Seller receiving it. Neither should be manufactured from page visits, self-reported payment claims or unverified reviews.

## Rules

### LIVE start
- The active, published Hustler is authorized using existing LiveService.requireHost and session ownership.
- Only a successful DRAFT → LIVE transition emits an event. CAS `updateMany({ id, hostUserId, status: DRAFT })` and the notification write are in the same Prisma transaction. A second start is rejected without new alerts.
- Fan out to users in authoritative `UserFollow` where `followingId` equals the host. No self alert. Exclude followers with either-direction `UserBlock` record against host, respecting existing bilateral block semantics.
- Efficient INSERT…SELECT in SQL writes without loading the entire follow graph into API memory, with unique `eventKey=live:started:<id>` for retry protection. PostgreSQL generates IDs; the normal per-recipient unique index handles duplicates.
- `NotificationKind.LIVE` links to the public `/live/:id` page. The destination retains Live public/ended visibility checks and does not grant access to hidden content.
- A draft creation, pin change, media-presence ping, and ending a Live do not generate new alerts.

### Verified Review
- Only the canonical ReviewService transaction generates the alert after eligibility, paid/completed transaction checks, related-party exclusions and unique reviewer constraint succeed.
- Notify `revieweeUserId` once using `NotificationKind.REVIEW`, `eventKey=review:verified:<id>`; never notify the reviewer about their own submission.
- Deep link to authenticated Booking/Order details using the verified subject's actual type and ID. The destination still enforces participant access. Avoid exposing full Review text, personal notes, rating, payment details or identities in the notification body.
- Review creation, reputation projection, SystemEvent and notification share an existing SERIALIZABLE transaction; if any fails, the notification is rolled back.
- Revoked/unpublished or ineligible Reviews do not create an alert.

## Data and authorization

No new database tables, grants, migrations, direct browser notification creation or payment authority. Reuses RLS-protected Notification table and existing enum. Does not send device push/email. Production deployment requires separate owner permission.

## Validation

Extend the **disposable PostgreSQL/Nest** sandbox `scripts/payment-sandbox/run.mjs`:
- [x] Paid/completed Order permits exactly one buyer-authored verified Review, not seller self-review and not duplicate Review.
- [x] Seller receives one REVIEW alert, buyer receives none.
- [x] Active Hustler LIVE session start notifies a follower once; cannot start twice.
- [x] A blocked follower receives no LIVE alert even if follower edge persists; host receives no self-alert.
- [x] Existing isolated paid-Order sandbox and Foundation CI green.

**Monday:** Review browser Activity links, unread and permissions with disposable Client/Hustler accounts. Full manual acceptance paused until October 12.
