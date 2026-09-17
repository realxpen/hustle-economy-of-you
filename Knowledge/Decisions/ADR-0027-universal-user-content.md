# ADR-0027 — Universal User Content Authority

Status: Accepted
Date: 2026-09-17

## Context
Hustle uses one User identity with additive capabilities. Everyone begins as CLIENT; HUSTLER and AGENT add permissions to that same identity.

Content creation must follow the same model. Restricting Posts or Stories to HUSTLER would incorrectly turn a capability into a separate social identity and would prevent Clients from sharing experiences, recommendations, buyer perspectives, discoveries and references to other people's work.

## Decision
**Posts and Stories are User-level capabilities.** Every authenticated Hustle user may create them regardless of whether HUSTLER is active.

HUSTLER remains required for creator-owned professional commerce surfaces such as publishing/selling Services and Products and maintaining the professional storefront. It is not required to speak, post, share or tell a Story.

A Client-authored Post or Story may:
- share an experience or opinion;
- recommend or criticize a Service/Product within platform policy;
- mention another user by `@username`;
- reference any currently published Service or Product;
- participate in discovery, likes, comments, follows and sharing under the same public content rules.

References are pointers to authoritative public Hustle entities. They do not transfer ownership and do not imply that the referenced Hustler authored or approved the content.

## Verified review boundary
A Post or Story may contain review-style language, but social content is not a `Review` record and must not affect `UserReputation`.

The only public reputation authority remains:
`eligible verified transaction → Review → UserReputation`.

This prevents a user from manufacturing verified trust simply by creating content.

## Legacy Post storage compatibility
The current Post schema requires a `professionalProfileId`. Until Post is migrated to a direct `userId` author relation, the API may lazily create/use a DRAFT ProfessionalProfile as an internal storage anchor for a Client-only author.

That compatibility anchor:
- does not grant HUSTLER capability;
- does not publish a professional profile;
- does not make `/u/:username` a professional storefront;
- must not expose draft professional fields publicly;
- does not change User identity as the actual content authority.

A future schema cleanup may move Post author authority directly to `userId` without changing this product decision.

## Discovery
Published Posts from Client-only and Hustler users are eligible for Home discovery and interactions. Ranking may use public professional context when present but must not require it.

Service/Product marketplace authority remains unchanged: only valid published offers from eligible Hustlers can exist as reference targets.

## Identity links
Client-authored content must not imply that the author has a professional storefront. Professional storefront links should render only when a public professional profile exists. User mentions may still resolve the public identity data appropriate to the available surface.
