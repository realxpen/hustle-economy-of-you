# ADR-0054 — Phase 21B: Opt-in Opportunity Attribution

**Status:** Implemented in feature branch; CI and Monday acceptance pending
**Date:** 2026-10-10
**MVP boundary:** No migration, financial state change, production deployment or third-party tracking SDK.

## Intent

Hustle's public discovery and private economic actions are already stored separately. Analytics Phase 21A correctly rejected fake "conversion" claims from unlinked event totals. Phase 21B adds a deliberately limited **consented association**, not a causal conversion model.

## Consent contract

- Account → **Optional Analytics** has an explicit **Allow optional attribution** control. Off by default for everybody, including old accounts.
- Only the authenticated user can read or update this choice: `GET/PUT /api/v1/events/attribution-consent`, guarded by `AuthGuard` and resolved from their token's `authSubject`; the request may not supply another User ID.
- Consent preference uses append-only `SystemEvent` names `attribution.enabled` and `attribution.disabled` with server-only source `attribution-preference`. The older unauthenticated generic `POST /events` does **not** allow this source and cannot masquerade as consent. The generic collector now also blocks protected feed/search/marketplace/attribution/analytics event namespaces.
- Repeated same-choice requests create no new events. The last valid preference is authoritative; users can opt out at any time and are then excluded **entirely** from the linked-outcome aggregates.
- Opting back in starts a fresh attribution period and never retroactively qualifies old clicks or old Bookings/Orders.
- Existing non-attribution feed, search, and marketplace event collection remains unchanged. This feature is not a mechanism for deleting all already-collected event data; existing retention and privacy policy work is **separate and needed** before broad launch.

## Eligible signals and offer match

- Only **real Service or Product result taps** (not general views, impressions, search terms, likes, comment contents or personal profile opens) are eligible.
- On `feed.service_clicked` and `feed.product_clicked`, the Feed service already authorizes a published Post and confirms the clicked offer is attached and published. Server checks consent and records `attributionEligible=true` only when enabled.
- On `search.result_clicked` and `marketplace.result_clicked`, the Search service checks the target is a currently published Service or Product before stamping the server-verified consent flag. No browser-supplied consent or actor User ID is trusted.
- The reporting query requires: **same authenticated viewer** as the Booking Client or Order Buyer, **exact same Service** as the Booking or one of the exact Product IDs in the Order, eligible source, click before outcome creation, and a **seven-day lookback** after the *latest* opt-in.
- A Booking or Order is associated at most once using the **last qualifying offer tap** across Feed, Search and Marketplace. Multi-product Orders do not double count.
- Admin-only aggregates return `consentingOutcomes`, `linkedOutcomes`, and last eligible click source counts for Bookings and Orders. No User IDs, Post IDs, orders, names, or click times are sent to the dashboard.
- The window 7/30/90 days applies to **Booking/Order creation date**. Eligible offer tap may precede the window start by up to seven days, but must follow active consent.

## Interpretation and limitations

**This is an observational association, not proof of causation.** Users can tap unrelated offers and change their minds; not all taps necessarily represent meaningful discovery. Client events may still be automated or retried; strong idempotent unique-visitor instrumentation is not yet present. Do not report `linkedOutcomes / consentingOutcomes` as a true traffic conversion rate or imply that a tap *caused* a purchase.

The baseline Phase21A canonical payment, Booking, Order, Review and app lifecycle reports are not modified. Attributed **Order placed** is not attributed **paid revenue**. No payment credentials, private conversations, location histories, device identifiers, phone numbers or financial totals appear in reporting.

For performance at scale, production index and retention policy evaluation will be needed: the existing SystemEvent payload JSON and canonical OrderItem matcher intentionally avoid a new migration in the weekend build but are not yet optimized for millions of events. No new production schema migration may be applied without owner approval.

## Automated acceptance and release

- Verify default off, strict boolean preference and authenticated endpoint, server-only source, forbidden generic telemetry spoof.
- Verify real, consent-stamped offer clicks and same-user/same-offer matching before Booking and Order, including multi-offer channel selection.
- Verify opted-out state excludes previously associated outcomes, re-enabled state does not backfill and new opt-in clicks link only new outcomes.
- Verify Admin-only aggregation and all prior isolated payment, Live and Review regressions.
- No manual tests or automatic API/Web/Admin deployment until Monday 2026-10-12. Owner will authorize deployments and consolidated visual/runtime acceptance.
