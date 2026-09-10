# Messaging

Status: Active
Created: 2026-09-10
Last Validated: 2026-09-10

## Purpose

Phase 10 turns discovery into direct conversation inside Hustle.

The core transition is:

`Discovery → Conversation → Opportunity`

A user who discovers a person, Post, Service, or Product should be able to contact the relevant person without leaving Hustle.

## Phase 10 goal

Allow any synchronized Hustle user to start and continue a direct conversation with another synchronized Hustle user.

The canonical MVP entry points are:

- Profile → Message
- Service → Message
- Product → Message
- Post → Message Creator

## Identity rule

Messaging belongs to the same unified Hustle identity.

There is no Client inbox, Hustler inbox, Agent inbox, role switcher, or seller-only messaging account.

A single User may participate in conversations regardless of whether that identity currently has CLIENT only or additive HUSTLER / AGENT capability.

## MVP messaging capabilities

Phase 10 must support:

- one-to-one conversations
- text messages
- image messages
- file messages
- timestamps
- per-participant read state
- typing state
- basic notification-ready events

## Conversation model

The stable ownership model is:

`Conversation`
`├── ConversationParticipant → User`
`└── Message → User (sender)`

A direct conversation contains exactly two participants in the Phase 10 MVP.

The architecture should not prevent group conversations later, but group chat is not required for this gate.

## Conversation reuse

Starting a direct message with the same person should resolve the existing direct conversation rather than create endless duplicate threads.

The direct-pair identity must therefore be deterministic and enforceable server-side.

## Message content

A Message may contain:

- text
- one image attachment
- one file attachment
- one optional canonical context attachment

At least one meaningful content element is required.

For MVP storage, message metadata should reference uploaded/private storage objects rather than placing binary content in PostgreSQL.

## Context attachments

Messages may carry a canonical reference to:

- Service
- Product
- Post

Future phases may add:

- Booking (Phase 11)
- Order (Phase 12)

Context references must not duplicate canonical price, inventory, booking, or order state inside the Message.

The UI resolves the current safe public/currently-authorized representation of the attached entity.

## Entry-point behavior

### Profile → Message

Starting from a public professional profile creates or opens the direct conversation with that User.

### Service → Message

The conversation is with the Service owner's User identity and may include the Service as initial context.

### Product → Message

The conversation is with the Product owner's User identity and may include the Product as initial context.

### Post → Message Creator

The conversation is with the Post creator's User identity and may include the Post as initial context.

## Authorization

- A synchronized User may message another synchronized User.
- A User cannot create a direct conversation with themselves.
- Only conversation participants may read its messages.
- Only a participant may send to the conversation.
- A sender may only attach context that the recipient is permitted to resolve under the relevant domain's visibility rules.
- Server-side checks are authoritative.

## Read state

Read state belongs to the participant, not the Message row.

Minimum model:

- `ConversationParticipant.lastReadAt`

Unread count is derived from messages newer than that participant's last read time and not sent by that same participant.

Do not add a mutable `read=true` flag to every Message for every participant.

## Typing state

Typing is ephemeral presence, not durable conversation history.

Phase 10 may implement typing through a short-lived realtime mechanism and must not write a database row for every keystroke.

If realtime infrastructure is unavailable, messaging history must still function; typing indicators are degradable UX.

## Notifications

Phase 10 emits notification-ready/message events, but Phase 20 owns the complete Notifications product.

Do not build a full notification center here.

## Data lifecycle

Messages are operational communication records.

For the MVP:

- conversation/message deletion should not silently erase the other participant's history
- hard-delete semantics are deferred until account/data-retention policy is explicitly designed
- attachment access must remain private and participant-scoped
- consequential moderation/audit requirements remain later trust/admin work

## Explicit boundaries

Phase 10 does **not** own:

- Booking lifecycle — Phase 11
- Cart or Orders — Phase 12
- Payments / escrow / invoices as financial truth — Phase 13
- Reviews / ratings / reporting / blocking policy — Phase 14
- Stories replies — Phase 16
- Live chat — Phase 17
- Agent delegation — Phase 18
- full operational labels / CRM inbox workflows — later product evolution unless separately approved
- full notification center — Phase 20

Do not invent fake Booking/Order entities just to satisfy context attachment fields before those domains exist.

## Observation

Messaging should produce inspectable events through the existing SystemEvent foundation where useful, including:

- `messaging.conversation_started`
- `messaging.message_sent`
- `messaging.context_opened`

These observations must never become the source of truth for conversation/message state.

## Phase 10 gate

A real synchronized CLIENT can:

`discover xpen → Message → send text → receive a reply → attach/open a current Post/Service/Product context → refresh/reopen → history and read state persist`

The same identities and capabilities remain unchanged.

## Success condition

A prospective client can contact a Hustler without leaving Hustle, and the conversation can retain the economic/discovery context that caused the message.