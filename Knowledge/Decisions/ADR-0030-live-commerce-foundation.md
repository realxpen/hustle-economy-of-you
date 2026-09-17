# ADR-0030 — Live Commerce Foundation

Status: Accepted
Date: 2026-09-17

## Context
Phase 17 introduces Live Commerce after the completed Stories and universal User-content phase. Hustle Live must connect real-time demonstration to the same identity, Service, Product, Booking, Order, Trust and Safety systems already established elsewhere in the product.

The foundation must not invent a second creator identity, copy commerce entities into a Live-specific store, or claim that a placeholder UI is a real media broadcast.

## Decision

### Host authority
Watching a public Live is available to any visitor. Commenting requires an authenticated Hustle User.

Hosting is an economic capability: a host must have an ACTIVE `HUSTLER` capability and a PUBLISHED `ProfessionalProfile`. Hosting does not use a role switcher and does not create a separate account.

### Session lifecycle
MVP sessions use server-authoritative states:

`DRAFT → LIVE → ENDED`

`CANCELLED` is reserved for a later explicit cancellation flow.

A host may have at most one active LIVE session at a time. An ended session cannot be changed or restarted.

### Pinned commerce
A Live may pin at most one commerce offer at a time: `SERVICE`, `PRODUCT`, or none.

A pinned Service/Product must be:
- currently PUBLISHED;
- owned by the Live host's canonical professional profile.

Pinning references the canonical entity by ID. It does not copy ownership, pricing, inventory, booking, payment or order state into the Live session. Viewer actions continue into the existing canonical Service/Product transaction flows.

### Audience presence
Viewer presence uses an opaque browser viewer key and a short active-presence window. Presence is product telemetry, not identity verification, trust evidence or reputation.

### Comments
Live comments are public room conversation attached to the Live session. Any authenticated Hustle User may comment while the session is LIVE, including the host. A non-host commenter must pass Hustle's existing `UserBlock` direct-contact policy against the host, so Live cannot bypass an established block.

### Media boundary
Phase 17A establishes the real Live session/control/commerce layer but does not pretend to provide native media publishing before transport exists.

A host may optionally attach a legitimate public HTTP/HTTPS playback URL, including a supported YouTube Live URL or another browser-playable source. The public read model reports `nativeBroadcasting: false` in 17A.

A session may therefore be genuinely LIVE in Hustle's session/commerce sense while no playback source is attached. The UI must state that condition plainly rather than render fake video.

Native Hustle camera/microphone capture, ingest, playback delivery and provider-issued publishing credentials belong to the next Live media-transport slice.

### Conversion observation
Live → host profile, Service and Product clicks emit controlled `SystemEvent` observations with server-derived target IDs. These signals are product analytics only and never modify verified public reputation.

### Database authority
`LiveSession`, `LiveViewerPresence`, and `LiveComment` are API-owned application tables. RLS is enabled and direct `anon` / `authenticated` Data API privileges are revoked. Only the trusted `hustle_api` database role receives CRUD policy authority.

## Invariants
- One Hustle User identity remains authoritative.
- Client-only users can watch and comment but cannot host commerce Live.
- A Live host cannot pin another Hustler's Service/Product.
- Live never creates its own price, inventory, booking, order, payment or reputation authority.
- Live comments and presence never change `UserReputation`.
- UserBlock policy cannot be bypassed through Live comments.
- `nativeBroadcasting` remains false until native transport is genuinely integrated and runtime-validated.
- No provider secret, stream key or publishing credential may be committed to the repository or exposed through a public read model.
