# ADR-0037 — Delegated Bookings and Client Messages

Status: Accepted
Date: 2026-10-07

## Context

Phase 18D activates delegated Profile, Service, Product and Content operations.

Agents also need to help represented people handle customer requests and direct communication. These surfaces are more sensitive because Booking state may intersect with payment/escrow and messaging can create the false impression that the principal personally typed a message.

## Decision

Phase 18E activates two existing relationship scopes:

- `BOOKING_MANAGE`
- `CLIENT_MESSAGE_MANAGE`

through a dedicated Agent client-operations API.

## Booking boundary

`BOOKING_MANAGE` requires:

1. ACTIVE AGENT actor;
2. ACTIVE principal↔Agent relationship;
3. active `BOOKING_MANAGE` grant;
4. no block between principal and Agent;
5. represented principal has ACTIVE HUSTLER.

Allowed first-slice actions:

- view the represented Hustler's Bookings;
- accept a REQUESTED Booking and confirm the requested schedule;
- decline a REQUESTED Booking;
- cancel an ACCEPTED or PAYMENT_PENDING Booking before funding;
- start free ACCEPTED work or paid FUNDED work.

Explicitly prohibited:

- Booking completion;
- funding;
- escrow release;
- refund;
- dispute resolution;
- payout;
- any direct wallet/ledger operation;
- Review or reputation changes.

The absence of a delegated completion endpoint is intentional. Completion can participate in settlement/review eligibility and remains owner-only until a later governance decision.

All delegated Booking mutations write `AgentDelegationAudit` with Agent actor and Hustler owner, while preserving canonical Booking events with explicit delegated actor metadata.

## Messaging boundary

`CLIENT_MESSAGE_MANAGE` requires:

1. ACTIVE AGENT actor;
2. ACTIVE principal↔Agent relationship;
3. active `CLIENT_MESSAGE_MANAGE` grant;
4. no block between principal and Agent;
5. the target conversation belongs to the represented principal;
6. no block between the represented principal and conversation counterparty.

The first slice allows:

- reading the represented principal's existing direct conversations;
- reading message history;
- sending text replies on behalf of the represented principal.

It does not allow:

- private attachment upload by Agent;
- typing-state impersonation;
- clearing the principal's unread/read state;
- deleting conversations;
- changing participant membership.

## Message provenance

A delegated message keeps `Message.senderId = principalUserId` so the canonical two-party conversation and unread semantics remain correct.

A new nullable `Message.delegatedByAgentUserId` records the real Agent actor.

Recipient and principal UIs must expose this provenance, e.g.:

> Agent-assisted · Jane Agent sent this on behalf of Ade Hustler

The Agent actor is also recorded in `AgentDelegationAudit` and `SystemEvent`.

This prevents silent impersonation while preserving the represented person's conversation identity.

## Read-state rule

Agent reading a represented conversation does not update the principal's `ConversationParticipant.lastReadAt`.

The principal therefore does not lose unread indicators merely because an Agent inspected the thread.

## Ownership

Agents never become Booking clients/Hustlers, Conversation participants, wallet owners, message account owners, Review authors, or reputation owners.

The principal remains the owner/subject. The Agent remains an audited delegated actor.
