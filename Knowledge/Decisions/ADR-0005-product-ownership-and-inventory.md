# ADR-0005 — Product Ownership and Inventory

Status: Accepted
Date: 2026-09-09

## Context

Phase 6 introduces physical and digital products after Hustle has already established one User identity, additive capabilities, a ProfessionalProfile and Services.

The product layer must preserve the single-account model and provide stable records for later cart, order, payment and content-attachment phases.

## Decision

A Product belongs to the seller's existing ProfessionalProfile.

Canonical relationship:

`User → ProfessionalProfile → Product → ProductVariant`

Only ACTIVE HUSTLER identities may create or mutate Products in the Phase 6 MVP.

No separate seller account, shop account, business role or role switcher is introduced.

## Product type

Products explicitly support:
- PHYSICAL
- DIGITAL

## Publication state

Products use:
- DRAFT
- PUBLISHED
- PAUSED

Inventory availability is modeled separately from publication state.

## Money representation

Product prices are stored as integer minor units and currency code, consistent with the Service foundation.

Nigeria-first MVP currency is NGN.

## Inventory

Inventory tracking is explicit.

A Product can opt into inventory tracking. When enabled, quantity must be non-negative and public availability must reflect current stock.

Digital or effectively unlimited products may operate without inventory tracking.

## Variants

Variants are child records, not duplicate Products.

A ProductVariant may define seller-controlled option values, an optional SKU, optional price override and optional inventory quantity.

This preserves one canonical Product while allowing later cart/order lines to reference the exact selected variant.

## Commerce boundary

Phase 6 creates purchase-ready product records and public pages only.

It does not invent checkout or payments. Phase 12 owns cart/orders and Phase 13 owns payments/escrow.

Later commerce systems must reference the Product and optional ProductVariant records rather than duplicating offer data into new seller entities.

## Consequences

This architecture keeps Services and Products parallel under the same professional identity, supports both physical and digital commerce, preserves inventory correctness, and gives later content, search, cart, order and payment phases stable entities to attach to.
