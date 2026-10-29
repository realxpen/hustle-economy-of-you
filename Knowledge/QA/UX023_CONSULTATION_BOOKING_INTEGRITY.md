# UX023 — Consultation-to-Booking integrity

Founder confirmed live search Post/Service navigation on iPhone (UX022). The next milestone is turning a published Service into a coordinated, **server-authoritative** Booking request.

## Verified gap
In isolated staging, the existing Booking API requires a real `Message` tagged with that Service ID before accepting a `CONSULTATION`-mode Booking. Opening a direct thread alone does not suffice. The web form offered optional consultation wording rather than making this prerequisite explicit. Ordinary APPOINTMENT and WORK_QUEUE Bookings permit `conversationId` to be omitted under ADR-0010, but the frontend previously required every Messaging direct-thread creation to succeed before sending any Booking.

## Implemented
- Explain the real Service-linked-message prerequisite to isolated consultation clients, with safe `/messages/start` context and return-to-Booking (including optional proof Post navigation). Preserve their two-hour same-tab draft.
- When the Booking API rejects consultation for missing discussion, provide an actionable consultation link. No fabricated consent/completion.
- For other modes only, tolerate a temporary Messaging HTTP **502/503/504** and send the Booking without optional `conversationId`. Never swallow auth/permission/not-found/conflict/rate-limit/network uncertainty or attempt financial operations. The API still authorizes every Booking and controls all terms, status, and availability.
- Existing Figma form, real search, server schedules, finance and schema unchanged.

## Acceptance
Real helper unit checks cover successful 502/503/504 fallback, consultation-mode fail-closed and denial of 401/403/404/409/generic errors. Local synthetic browser test asserts consultation instructions, exact Service context and safe Booking return with zero real Booking writes. Full Foundation, Cloudflare compatibility and isolated payment sandbox remain separate. Genuine signed-in two-account iPhone acceptance and production/payment gates are **not** established by fixtures.
