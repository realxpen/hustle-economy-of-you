# Mobile A3.5 — Service enquiry to consultation

Status: implementation prepared; runtime acceptance PENDING. No Expo APK or deployment is produced by this change.

## Knowledge and specification

Following merged A3.4 (#178), an enquiry can be prepared but reaches no provider. Reuse ADR-0009's canonical participant-owned direct conversation and Service context; do not introduce another enquiry database or booking model. The existing Web conversation supports a validated `/bookings/new/:serviceId` return path (ADR-0063/consultation continuity). Booking, reservation, payment and provider activation remain separate gates.

- The connected enquiry remains local by default. `EXPO_PUBLIC_HUSTLE_ENABLE_ENQUIRY_MESSAGES=true` explicitly enables messaging in a separately approved build; this PR changes no environment/profile value.
- Review first, then confirm the named recipient and exact message via a deliberate native alert. Only that action opens/reuses the direct conversation and sends one text message with canonical SERVICE context. No writes on typing, review, availability reads or navigation.
- Include optional still-future backend-listed appointment preference, timezone and ISO instant as text with **not reserved** wording. Otherwise state scheduling must be agreed. Search results and prices are not copied into authoritative transaction state.
- Validate the returned conversation's counterpart/viewer before sending and validate the exact message acknowledgement before displaying **sent**. Blocked/unpublished/service authorization remains server-owned.
- Synchronous duplicate-tap lock; no automatic message retries. If opening the conversation fails, retry is safe because no message was attempted. Once the message POST starts, any error/timeout/malformed acknowledgement means **delivery uncertain**, not failed/not sent. Preserve the draft and offer the canonical conversation for checking before another enquiry. This is not server-side exactly-once delivery.
- Close/service/session change invalidates pending callbacks and prevents a late direct-open response from initiating a message. Once POST starts, closing cannot undo delivery; disclose that it may still arrive. Session changes clear private state. No logs, analytics, storage or URL query may contain draft text, tokens or account credentials.
- After an acknowledgement or uncertain send, offer the exact Web conversation with a validated Service booking-form return hint. Browser login is separate; do not transfer native auth or private draft through the URL. Browser participation and Booking API authorization still apply. This change is not a native inbox or guaranteed provider read receipt.

## Architecture and experience

Pure `enquiryConsultation.ts` prepares the message and owns a dependency-injected one-attempt delivery state machine. The existing mobile API adapter gains only the two existing messaging POSTs with a 20-second client timeout. `MobileExperience` owns in-memory draft/review/delivery state. No API/schema/dependency changes. Default-off shipping and offline A1/A2 behavior remain unchanged. Enquiry review states distinguish not sent, sending, acknowledged sent, and uncertain. Editing cannot re-arm a completed/uncertain message attempt.

## Validation

Executable tests use the actual transpiled TypeScript with synthetic transports: payload/context, stale preferences, malformed owner, counterpart mismatch, success acknowledgement, duplicate taps, direct failure/retry, timeout/unknown result/no resend, invalidation between requests, and strict no-secret conversation URLs. Source guards check explicit confirmation, opt-in, session cleanup, fixed backend endpoints and unchanged booking/payment boundaries. Existing A3.1–A3.4, offline, TS/Metro and Gradle gates remain required.

Signed-in two-account staging message exchange, blocked recipient/unpublished Service behavior, separate-browser sign-in/return-to-booking, physical Android Alert/Back/large-text/TalkBack, and network interruption after commit are NOT PERFORMED. CI/synthetic transport tests do not prove these. Owner reviews/merges after exact-head checks; no self-merge, live messages, booking writes, payment, production release or Vercel rerun is authorized by this PR.
