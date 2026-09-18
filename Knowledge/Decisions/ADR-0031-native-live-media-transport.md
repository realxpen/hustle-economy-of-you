# ADR-0031 — Native Live Media Transport

Status: Accepted
Date: 2026-09-18

## Context
Phase 17A established real Hustle Live session, commerce, presence, comments and host authority, but deliberately kept `nativeBroadcasting: false` until camera/microphone transport existed.

Phase 17B needs real browser publishing and viewer playback without creating a second identity or exposing reusable provider credentials to clients.

## Decision

### Transport
Hustle uses LiveKit-compatible WebRTC transport for the native Live beta.

The browser client is pinned to LiveKit JS Client SDK 2.22.3. Local development may use a self-hosted LiveKit server; production may use a separately configured LiveKit Cloud or self-hosted endpoint.

The media transport is an infrastructure adapter. Hustle's own `LiveSession` remains authoritative for lifecycle, commerce, comments and product analytics.

### Credential authority
Only the Hustle API holds:
- `LIVEKIT_API_KEY`;
- `LIVEKIT_API_SECRET`.

The browser never receives either value.

The API signs short-lived participant credentials:
- host credential: room join + subscribe + publish only camera/microphone;
- viewer credential: room join + subscribe, no publishing;
- token TTL: 10 minutes for initial join authority.

LiveKit room names and participant identities use opaque Hustle IDs/hashes rather than email, phone number, real name or other PII.

### Host lifecycle
The host may connect camera/microphone while the Hustle session is DRAFT so they can preview media before going LIVE.

The host browser:
1. requests a server-authorized publish credential;
2. joins the LiveKit room;
3. enables camera and microphone;
4. sends an authenticated media-presence heartbeat to Hustle;
5. may then start the canonical Hustle Live session.

Camera and microphone can be muted/unmuted without changing the canonical Live lifecycle.

### Viewer lifecycle
A signed-out visitor may request a subscribe-only viewer credential only while the canonical Hustle session is LIVE.

The server hashes the opaque Hustle viewer key before using it as a media participant identity.

The viewer automatically reconnects after transport loss and requests a new join credential when a full rejoin is required.

### Real broadcasting state
`LiveMediaPresence` records only short-lived host transport presence. It is API-owned, protected by RLS and never exposed as direct browser table authority.

A recent host heartbeat makes `media.nativeBroadcasting` true. Stale or disconnected presence makes it false.

This prevents Hustle from claiming native video is live merely because a LiveKit endpoint is configured.

### External playback
The existing external playback URL remains an optional fallback. Native WebRTC transport is primary when the host is actively broadcasting.

No external URL is copied into a new commerce authority.

### Local development
The repository contains no reusable provider secret.

`npm run live:setup` generates/preserves local LiveKit credentials inside gitignored `.env` and `apps/api/.env`.

`npm run live:up` starts local LiveKit using Docker when available. On Linux without Docker, Hustle downloads the pinned official LiveKit Server v1.13.7 release binary into the gitignored `.hustle-tools/` cache and starts it with the same local credentials.

### Out of scope
Phase 17B does not add:
- recording/egress or replay media;
- multi-host/co-host broadcasting;
- screen sharing;
- background effects;
- production TURN/domain deployment automation.

Those may be added later without changing the canonical Live commerce authority.

## Invariants
- Only ACTIVE HUSTLER + PUBLISHED ProfessionalProfile can receive host publish authority.
- Viewers cannot publish tracks.
- Browser code never receives `LIVEKIT_API_SECRET`.
- No reusable provider credential or stream key is committed.
- Native media state never affects verified `UserReputation`.
- LiveKit transport failure cannot mutate Booking, Order, payment, inventory or reputation state.
- Ending the canonical Hustle Live session clears host media presence.
