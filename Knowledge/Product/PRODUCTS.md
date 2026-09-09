# Products Marketplace Foundation

## Purpose

Phase 6 allows an ACTIVE Hustler to publish physical or digital products as concrete offers attached to the same professional identity.

Hustle source defines the Phase 6 product foundation around:
- title
- description
- images / video
- price
- category
- inventory
- variants
- delivery information
- status

The product relationship is:

`User → ProfessionalProfile → Product`

A Product is not a separate shop account, seller identity or role mode.

## Product types

The MVP supports:
- PHYSICAL
- DIGITAL

Physical products may require stock and delivery information.
Digital products may not require physical inventory or delivery logistics.

## Product lifecycle

The MVP publication lifecycle is:
- DRAFT
- PUBLISHED
- PAUSED

Out-of-stock is inventory state, not a separate identity or seller mode.

## Product fields

Foundation fields:
- title
- description
- category
- media URLs
- product type
- price in integer minor units
- currency (NGN first)
- inventory tracking flag
- inventory quantity
- delivery information
- publication status
- published timestamp

## Variants

Products may have variants such as size, colour, format or other seller-defined choices.

The MVP should model variants as child records of Product rather than duplicating Products.

A variant may contain:
- name
- SKU (optional)
- option values
- optional price override
- optional inventory quantity
- active/inactive state

Variants remain part of the same Product and seller identity.

## Ownership and authorization

Only a User with ACTIVE HUSTLER capability may create or mutate Products in Phase 6.

A Product belongs to the User's existing ProfessionalProfile.

Publishing requires:
- ACTIVE HUSTLER
- PUBLISHED ProfessionalProfile
- required product fields
- valid non-negative price
- valid inventory state when inventory tracking is enabled

Profile edits, Product edits and Product publication never grant or remove capabilities.

## Public product experience

A public Product page should show enough information for a visitor to understand what is offered and who sells it:
- product media
- title
- price
- category
- description
- product type
- variant choices where present
- stock/availability state
- delivery information
- seller professional identity
- link to `/u/[username]`

Private contact information must not appear in the public Product payload.

## Commerce boundary

Phase 6 makes Products purchase-ready but does not implement fake checkout.

The approved phase plan owns real product commerce in later phases:
- Phase 10 — Messaging
- Phase 12 — Cart + Orders
- Phase 13 — Payments + Escrow

Those systems must reference the stable Product / ProductVariant records created here.

## Phase 6 gate

A real ACTIVE Hustler must be able to:

`create Product draft → add product details/media/inventory/variants → save → publish → open public Product page as a visitor → see the Product attached to the same professional identity`

CLIENT remains ACTIVE. No role switcher.
