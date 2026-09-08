# Services Marketplace Foundation

## Purpose

Phase 5 lets an ACTIVE Hustler turn demonstrated capability into a concrete service offer attached to the same professional identity.

Canonical relationship:

`User → ProfessionalProfile → Service`

A Service is not a seller account, role mode, storefront account or separate identity.

## Source basis

The current Hustle business plan and MVP build plan define service listings around:

- title
- category
- description
- media
- price
- pricing type
- location
- remote / physical delivery
- availability
- delivery time
- client requirements

The wider business plan also anticipates FAQs, add-ons and booking availability. Those are not required for this Phase 5 slice because the approved phase order keeps booking and richer transaction behavior in later phases.

## Phase 5 experience

ACTIVE HUSTLER
↓
Professional profile
↓
Create service draft
↓
Define offer
↓
Save / edit
↓
Publish
↓
Visitor opens service page
↓
Visitor sees the offer and the professional identity behind it

## Service state

MVP states:

- DRAFT
- PUBLISHED
- PAUSED

DRAFT is owner-only.

PUBLISHED is publicly resolvable.

PAUSED preserves the offer for the owner while removing public availability.

A published service must be paused before it can be deleted.

## Publication requirements

A service may remain incomplete while in DRAFT.

Publishing requires:

- published professional profile
- ACTIVE HUSTLER capability
- title
- category
- description
- positive price
- availability note
- delivery time
- location when physical delivery is involved

Media and client requirements are supported but optional for publication in this MVP slice.

## Pricing

The source requires a pricing type but does not prescribe exact values.

Phase 5 uses a deliberately small MVP set:

- FIXED
- STARTING_AT
- HOURLY

Amounts are stored as integer minor units with `NGN` as the Phase 5 currency so API/database values remain transaction-safe for later payment work.

## Delivery

The source distinguishes remote and physical work.

Phase 5 represents this as:

- REMOTE
- PHYSICAL
- BOTH

`availabilityNote` is descriptive availability only. It is not a booking calendar.

`deliveryTime` is a simple human-readable expectation such as `Same day`, `3 days` or `2 weeks`.

## Media

A service can hold up to 8 public image/video URLs in the thin Phase 5 experience.

This satisfies the listing/media relationship without inventing the later content/media creation systems early. A dedicated service media upload workflow can replace the URL-entry surface later without changing the Service identity.

## Authorization

Only the owner of the attached ProfessionalProfile may create, edit, publish, pause or delete that service.

Owner mutations require ACTIVE HUSTLER.

Publishing additionally requires the ProfessionalProfile itself to be PUBLISHED.

Public resolution requires all of:

- Service = PUBLISHED
- ProfessionalProfile = PUBLISHED
- owner HUSTLER = ACTIVE

Public payloads do not expose owner email or phone.

## Public route

MVP visitor route:

`/services/[serviceId]`

The service page links back to the same professional identity at:

`/u/[username]`

## Booking boundary

An earlier phase-plan gate described the service as something another user can genuinely book. The currently approved phase order places the actual booking system in Phase 11.

Therefore Phase 5 creates a real, booking-ready offer but does not simulate booking, payment or escrow.

Later booking records must reference this Service rather than creating a duplicate offer model.

## Phase 5 gate

A real approved Hustler can:

`create draft → edit → publish → open /services/[serviceId] as a visitor → see the service attached to the same professional identity`

CLIENT remains ACTIVE. No role switcher.
