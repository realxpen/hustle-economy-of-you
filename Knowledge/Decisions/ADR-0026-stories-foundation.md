# ADR-0026 — Stories Foundation

Status: Accepted
Date: 2026-09-17

## Context
Phase 16 introduces lightweight, temporary discovery. Stories must create a short path from attention to a real Hustle opportunity without becoming a second content system with separate identity or commerce truth.

## Decision
A Story is a server-authoritative record with a fixed 24-hour lifetime. The server owns `publishedAt` and `expiresAt`; clients cannot extend expiry.

Story media types are:
- `TEXT`
- `IMAGE`
- `VIDEO`

A Story may optionally reference the creator's own currently published Service and/or Product. Attachment authority is checked on write. If an offer is no longer public, the Story read model stops returning that offer rather than leaking paused or draft commerce data.

Story discovery and viewing are public while the Story is active. Story creation and deletion require authentication. Only the owner can delete a Story.

Phase 16A uses http/https media URLs as the media input contract so the lifecycle and authority can ship independently of the later native media-upload surface. Native Hustle storage can replace the input mechanism without changing Story identity, expiry or commerce authority.

## Public read boundary
The public Story read model may expose:
- Story content and expiry
- public creator identity
- public professional headline/primary skill where present
- currently published attached Service/Product summaries

It must not expose private trust/safety data, internal moderation data, auth subjects, private transaction details or unpublished offers.

## Business interaction
The Story viewer routes attached Services and Products into the canonical Hustle detail flows. Booking and buying therefore continue through the existing transaction authority rather than Story-specific payment logic.

## Follow-up slices
- Story views, reactions and replies
- home Stories row and sequential viewer
- native media upload/storage
- measurable Story → profile/service/product/booking/order events
