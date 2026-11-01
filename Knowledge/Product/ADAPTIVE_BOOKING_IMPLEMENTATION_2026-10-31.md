# Adaptive skill booking — application implementation boundary
Date: 2026-10-31. Status: proposed for review; no production migration or deployment.

## Supersedes the blanket consultation gate
Service authors choose `OFF`, `OPTIONAL` or `REQUIRED` consultations per published Service. A Client can submit a direct request without a consultation when that policy permits it. An explicitly required consultation must have the existing linked Service conversation proof. A paid consultation is **not** charged or marked paid by requesting a booking.

Consultation fees (minor NGN units) and credit eligibility are service settings only. Future separate payment infrastructure must collect and verify the consultation charge before storing a receipt, calculate `min(verified_paid, agreed_service_price)` as credit at most once, and amend outstanding service balance transactionally. Without a verified receipt, the current backend rejects acceptance of a paid-consultation request; it **does not** falsely treat the consultation as settled. This follow-up is an intentional financial blocker rather than a simulated real payment.

## Groups and flexible skill journeys
- Published Service owns configuration, including staffing capacity and a shared resource pool.
- Client provides `partySize` (1–50), optional consultation intent, a job brief and up to three HTTPS reference URLs.
- Multi-person bookings are opt-in per Service. For fixed-price services, the canonical base price means *per person*, so the stored subtotal is `unitPriceMinor * partySize`. No unstated extras are collected; variable-price group quotes currently require an explicit future negotiated-quote flow.
- FlowTime computes a conservative minimum duration `ceil(partySize / parallelCapacity) × defaultDurationMinutes` for appointments. It treats group requests as `min(partySize, parallelCapacity)` simultaneous occupants across that duration, leaving extra capacity unavailable rather than double-booking. Staff-specific allocations are a future refinement.
- Existing shared-pool advisory locking checks availability and persists acceptance in the same DB transaction. REQUESTED bookings do not reserve a slot; cancellation before acceptance does not charge money.
- This is not a verified individual-staff calendar or a full event bid/quote engine. Group travel, material, delivery, package and custom event fees require a later provider/client-approved quote and payment integration.

## Interfaces
- Service Editor: consultation requirements, fee, eligibility to credit, group booking toggle, existing FlowTime team capacity and resource pools.
- Book a Service: skip/choose consultation depending on policy, number of people, written requirements and links to references. Guest/public availability checks receive party size; session draft survives sign-in handoff.
- Booking detail: request type, party size, consultation choice and external reference links.

## Operational safeguards
- All new columns and database constraints have an additive Prisma migration; it has not been applied.
- Only active Hustlers control Service configuration and accept/decline existing booking requests; all participant authorization continues to reside in the Nest API.
- No live payments, credits, refunds, production DB writes or deployment are authorized by this PR.
- `scripts/experience/check-adaptive-booking.cjs` exercises compiled FlowTime scheduler with no external DB.
- Full production acceptance still requires PostgreSQL migration review, Prisma generation, CI, real account pilot, payment-provider authority and iPhone UI testing.
