# ADR-0005 — Service Offer Foundation

Status: Accepted
Date: 2026-09-08

## Context

Phase 5 introduces the first concrete economic offer attached to an approved Hustler's professional identity.

The business plan requires structured service listings with title, description, pricing, delivery timeline, location, media, availability and related service information. The existing architecture requires one identity and progressive capabilities, while bookings and payments belong to later phases.

## Decision

Introduce `Service` as a child of `ProfessionalProfile`.

Relationship:

`User → ProfessionalProfile → Service`

This makes the professional identity the stable provider context while preserving `UserCapability` as the authorization source of truth.

## Service lifecycle

Use:

- DRAFT
- PUBLISHED
- PAUSED

A Service may be edited in any state.

A PUBLISHED service must be PAUSED before deletion. This keeps the public lifecycle explicit and provides a clean path toward later transactional references.

## Publication invariant

Publishing requires:

1. owner has ACTIVE HUSTLER;
2. attached ProfessionalProfile is PUBLISHED;
3. required service fields are complete;
4. physical/both delivery has a location;
5. price is positive.

Public service lookup must also require the profile to remain PUBLISHED and HUSTLER to remain ACTIVE.

## Pricing representation

The source specifies price + pricing type but does not define the pricing-type taxonomy.

For the MVP use:

- FIXED
- STARTING_AT
- HOURLY

Store money as integer minor units (`priceMinor`) and currency code (`NGN`) rather than floating-point Naira. This allows later booking/payment work to reference stable monetary values.

## Delivery representation

Use:

- REMOTE
- PHYSICAL
- BOTH

Availability is currently descriptive text, not a calendar. Booking availability and scheduling remain Phase 11 concerns.

Delivery time is also human-readable text for the MVP rather than a scheduling primitive.

## Media

Store a small ordered array of public media URLs on Service for the thin Phase 5 experience.

Do not invent the broader media/content pipeline here. Later storage/upload work may replace URL entry without changing Service ownership or identity.

## Public identity

MVP public service route:

`/services/[serviceId]`

The service page exposes the offer plus safe professional-owner identity fields and links to `/u/[username]`.

Private email/phone are excluded.

## Booking conflict resolution

One historical phase-plan line described the Phase 5 gate as creating something another user can genuinely book. The current approved feature map still places the booking system in Phase 11, and the explicit Phase 5 build target is Service model + migration + owner API + editor + public page.

Therefore Phase 5 produces a real booking-ready offer but no fake booking action. Phase 11 must reference Service as the booking target.

## Consequences

- Services remain attached to the same professional identity.
- No seller-mode or role-switching architecture is introduced.
- Public service availability reacts to both service state and provider/profile state.
- Future bookings can reference stable Service IDs.
- Future payments can snapshot or reference minor-unit pricing without changing the MVP service model.
