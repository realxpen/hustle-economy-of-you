# ADR-0026 — Stories Foundation

Status: Accepted — amended 2026-09-17
Date: 2026-09-17

## Context
Phase 16 introduces lightweight, temporary discovery. Stories must create a short path from attention to people, experiences and real Hustle opportunities without creating a second identity or commerce truth.

The initial 16A implementation incorrectly treated Story commerce references as Hustler-owned attachments. That is too narrow for Hustle's unified-account model: a Client may want to publish an experience, recommendation or review-style Story about another Hustler, Service or Product without becoming a Hustler.

## Decision
A Story belongs to the canonical **User identity**, not to the HUSTLER capability.

Every authenticated Hustle user may publish a Story. Being a Client-only user does not prevent Story creation. HUSTLER remains an additive capability for owning/selling Services and Products; it is not a content-creation permission.

A Story is a server-authoritative record with a fixed 24-hour lifetime. The server owns `publishedAt` and `expiresAt`; clients cannot extend expiry.

Story media types are:
- `TEXT`
- `IMAGE`
- `VIDEO`

A Story may optionally:
- mention another Hustle user with `@username`;
- reference any currently published Service;
- reference any currently published Product.

The referenced offer does **not** need to belong to the Story author. References therefore support Client recommendations, experience sharing and social proof around other Hustlers' work. The server only resolves currently public offers; paused, draft or missing offers are not exposed in the public Story read model.

Story discovery and viewing are public while the Story is active. Story creation and deletion require authentication. Only the Story author can delete it.

Phase 16A uses http/https media URLs as the media input contract so lifecycle and authority can ship independently of native media upload. Native Hustle storage may replace the input mechanism without changing Story identity, expiry or reference authority.

## Public read boundary
The public Story read model may expose:
- Story content and expiry;
- public creator identity;
- public professional headline/primary skill only when the creator has a published professional profile;
- resolved public `@username` mentions;
- currently published referenced Service/Product summaries and their public owners.

It must not expose private trust/safety data, internal moderation data, auth subjects, private transaction details or unpublished offers.

## Reputation boundary
A Story can contain a recommendation, complaint, endorsement or review-style opinion, but that community content does **not** mutate `UserReputation` and is not labeled as a verified transaction review.

Only the existing Review authority may create verified reputation evidence:
`eligible completed Booking/Order → verified Review → UserReputation`.

This preserves the distinction between social expression and transaction-backed trust.

## Business interaction
The Story viewer routes referenced Services and Products into canonical Hustle detail flows. Booking and buying therefore continue through existing transaction authority rather than Story-specific payment logic.

## Follow-up slices
- Story views, reactions and replies
- home Stories row and sequential viewer
- native media upload/storage
- measurable Story → user/service/product/booking/order events
