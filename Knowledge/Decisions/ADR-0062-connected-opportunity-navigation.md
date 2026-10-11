# ADR-0062 — Connected proof-to-opportunity frontend navigation

Status: Implemented in branch; automated CI and owner runtime acceptance pending
Date: 2026-10-11
Scope: Web presentation/navigation and static QA. No backend contract, auth, financial or Agent delegation change.

## Context
Hustle's core economy loop must let a person discover proof of skill, understand who performed it, evaluate a real Product or Service and take a clear action. Existing Feed cards and OfferQuickView used canonical IDs, but deep linking frequently lost the original post context and modal action hierarchy required unnecessary navigation.

## Decision
A sourcePost URL parameter may be passed from a *real rendered feed Post* into canonical offer details, then to a Booking request. The parameter is only a **return navigation hint**, format-validated to avoid arbitrary URLs and kept before fragment anchors. It is not a trust badge, relationship proof, tracking signal or authority to make financial choices. Direct links without context work normally.

Keep real canonical offer endpoints for prices, seller ID, stock, Bookings and product Cart. OfferQuickView provides next best intent actions (book service, choose variant and add to Cart) alongside review, meet owner and return-to-post links. The modal uses dialog focus management and preserves owner/accessibility semantics.

Public Service/Product and Booking pages cancel stale async responses and provide retry flows. The public profile shortcuts connect real Work, Services and Products. Only the display of genuine Product media changes (object-fit contain; videos are user-controlled). Unpaid/stock authority language remains explicit.

## Alternatives rejected
- No forced conversion checkout or payment from a post overlay.
- No local optimistic price/availability promises.
- No unverified assumption that a caller-supplied sourcePost ID is a valid attachment.
- No parallel seller identity, role-switching or Agent finance delegation.

## Acceptance
See Knowledge/QA/CORE_OPPORTUNITY_JOURNEY_ACCEPTANCE.md. CI validates navigation contracts and application builds; owner-controlled deployments and device/runtime checks remain required.
