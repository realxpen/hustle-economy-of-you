# ADR-0009: Messaging conversation ownership and context references

Status: Accepted
Date: 2026-09-10

## Context

Phase 10 must allow discovery to turn into conversation without creating role-specific accounts or duplicating marketplace state inside chat.

Hustle already has one User identity with additive capabilities and canonical Post, Service, and Product records.

## Decision

Messaging will use a participant-owned conversation model:

`Conversation`
`├── ConversationParticipant → User`
`└── Message → User (sender)`

For the Phase 10 MVP:

1. Direct conversations contain exactly two distinct Users.
2. Repeated attempts to message the same User resolve the same direct conversation.
3. Conversation access is participant-only and enforced server-side.
4. Read state is stored per participant using `lastReadAt`, not duplicated as a per-user boolean on every Message.
5. Messages may reference one canonical Post, Service, or Product as context.
6. Message context stores identity/reference information only; current offer/content state remains authoritative in the owning domain.
7. Booking and Order context types are introduced only when Phases 11 and 12 create those canonical entities.
8. Typing is ephemeral and must not create durable database records per keystroke.
9. Message attachments use private object storage references; binary payloads do not live in PostgreSQL.
10. Messaging remains part of the NestJS modular monolith for the MVP. No dedicated messaging microservice is created prematurely.

## Rationale

This preserves Hustle's unified identity model, prevents duplicate direct threads, keeps authorization explicit, allows conversations to retain the discovery context that created them, and avoids coupling chat history to mutable marketplace snapshots.

Using participant-level read markers keeps the model suitable for later multi-participant conversations without requiring a read row for every message-recipient pair in the MVP.

## Consequences

Positive:

- CLIENT and HUSTLER users communicate through the same identity system.
- discovery surfaces can open a conversation with stable context.
- current Service/Product/Post data remains canonical.
- later Booking and Order domains can be added without rewriting existing chat records.
- realtime typing/presence can evolve independently from durable message storage.

Trade-offs:

- unread counts are derived rather than stored directly.
- direct-pair uniqueness needs an explicit deterministic key or equivalent server-side invariant.
- deleted/unpublished context may require a safe historical/fallback representation later.
- advanced CRM labels, calls, story replies, and live chat are intentionally outside this MVP decision.

## Rejected alternatives

### Separate Client and Hustler inboxes

Rejected because Hustle has one identity with additive capabilities and no role switcher.

### Copy Service/Product/Post data into every Message

Rejected because price, inventory, publication, and other mutable state would become stale and contradictory.

### Store typing state in PostgreSQL

Rejected because typing is ephemeral presence and would create unnecessary write volume/history.

### Create a standalone messaging microservice now

Rejected as premature infrastructure complexity before scale or failure-isolation evidence requires it.

## Affected systems

- Prisma/PostgreSQL
- NestJS Messaging module
- Web and later mobile inbox/conversation UI
- private object storage
- realtime/presence adapter
- SystemEvent observation
- Profile/Post/Service/Product entry points

## Gate

A synchronized CLIENT and HUSTLER can exchange persistent direct messages with correct participant authorization, read state, and canonical context references without changing either user's capabilities.