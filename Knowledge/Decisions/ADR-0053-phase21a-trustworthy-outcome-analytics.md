# ADR-0053 — Phase 21A: Trustworthy Marketplace Outcome Analytics

Status: MERGED PR #81 (`bddc64123096eb33c9481c23b73d517bc004f011`); Foundation CI `38042917665` and isolated Analytics/financial regression CI `38042917663` PASSED. Owner-controlled API/Admin deployment and Monday manual acceptance pending.
Date: 2026-10-10

## Why

Hustle is an opportunity ecosystem, not a vanity-attention app. Owner needs operational evidence that discovery helps people find useful Hustlers and results in conversations, genuine Booking and Order demand, fulfilled work and earned transaction reputation.

## Scope — read-only, Admin only

New `GET /api/v1/events/overview?days=7|30|90` is guarded by **AuthGuard + AdminGuard** and returns aggregated counts. It uses the existing `SystemEvent` observation store and canonical Prisma domain tables. No customer-level log exports, identities, search text, financial account information or individual analytics payloads leave this endpoint. No new schemas, migrations, scheduled jobs, provider credentials or billing are required.

A separate dark, responsive Admin route `/analytics` presents a date-window selector, canonical outcome cards, observation signals, daily milestones, accessible exact-count table and interpretation cautions. Linked from existing Admin Operations. The UI shares the existing authenticated Admin session; no public Analytics page or role switcher.

## Measurement contract

**Client-reported observations** (not verified visitors, not unique): `feed.view`, `feed.profile_clicked`, `feed.service_clicked`, `feed.product_clicked`, `search.performed`, `marketplace.result_clicked`, from recorded SystemEvent source web/mobile. Other tracked first-party events are returned in the record but can be shown later. Repeated/retried actions may inflate values. Existing capture path is not an immutable proof of a real human; NEVER use these counts as authoritative conversions.

**Authoritative operational milestones** (canonical records, date is when this milestone occurred):
- account creation, currently published ProfessionalProfile/Post with publication timestamp in period, current UserFollow created in period;
- new Conversation, actual Message, new Booking, Booking fundedAt, Booking completedAt;
- new Order, authoritative Order paidAt, Order completedAt;
- PaymentAttempt with status SUCCEEDED and domainAppliedAt in period (successful, applied **payment attempt**, not proof of distinct customers, gross merchandise value, or net revenue);
- Review with PUBLISHED status and `verifiedTransaction=true`, by its createdAt.

The daily UTC timeline uses **Booking.createdAt, Order.createdAt, Order.paidAt, Review.createdAt** with verified/published review filter. Days with no qualifying data display zero. All aggregation is from bounded 7/30/90-day windows, including the current UTC date. The snapshot includes generation time, period, source trust level and caveats. 7, 30 and 90 are the only supported values.

## Do not infer causation

Stage counts have **different denominators, participants and timestamps**. A booking requested this week might complete next week; an order paid this week might have been placed last week. Thus `paidOrders / feedViews` is NOT a measured conversion rate. Repeated feed observations are not unique users and lack authenticated end-to-end attribution. Refunds/disputes after completion mean milestone counts are NOT revenue. Never infer gross merchandise value, escrow releases or payout availability from analytics cards.

Follow-on Phase21B can design privacy-safe, consent-aware and idempotent journey tracking to join specific discovery actions to an opportunity; product/event definitions must be approved and instrumentation validated before presenting actual conversion rates or time-to-first-opportunity.

## Safety, build and release

- No prod DB migrations or read/write inspection needed to implement.
- Existing `POST /events` remains unchanged; reporting endpoint is guarded individually and does not expose raw public event capture.
- API aggregate is read-only; the Admin dashboard has no financial, moderation, capability or user mutation actions.
- Monorepo CI typechecks + builds and isolated Postgres/Nest sandbox assertions must pass before merging.
- Owner deliberately paused manual testing until Monday 2026-10-12. No API/Admin production deployment without owner authorization.
- Monday: compare known disposable Order/Booking outcomes against Admin Analytics 7/30/90-day windows, verify Admin-only access, keyboard/touch responsive dashboard and cross-surface navigation, check financial interpretation disclaimers.
