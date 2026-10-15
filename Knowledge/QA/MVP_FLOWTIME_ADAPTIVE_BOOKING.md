# Hustle FlowTime — Adaptive Booking & Capacity
Date: 2026-10-15
Status: **Proposed PR #122; implementation under CI. Owner approval and migration not yet performed.**

## Problem validated in code
Previously, the API's BookingScheduleService used a Boolean conflict across all confirmed Hustler bookings and checked it outside the accept transaction. Concurrent requests could race; a three-barber studio was treated like one sole proprietor.

## Delivered in this PR
- Booking modes: `APPOINTMENT` (capacity/time slots), `WORK_QUEUE` (max active orders), and `CONSULTATION` (no automatic calendar reservation).
- Hustler sets an IANA timezone, resource pool (same pool shares staff/equipment), weekly open windows, closures, default work duration, setup and cleanup buffers, parallel capacity, opt-in overbooking allowance, max active jobs, turnaround hours, and delay allowance.
- Client booking form reads authenticated, authoritative availability slots (30-min starts) and shows *remaining capacity* rather than other Clients' bookings. Browser checks availability again before request; a `REQUESTED` booking is **not** a guaranteed reservation. Actual availability may change before acceptance.
- Owner acceptance is the commitment point: a PostgreSQL advisory transaction lock scoped to Hustler plus capacity recheck and status+notification transition run in **the same database transaction**. Strictest normal capacity across overlapping services in a resource pool avoids overpromising shared workers with differently configured Services.
- Queue work can accept concurrent requests until `maxActiveJobs`; it is not interpreted as time-blocked appointments. Consultation mode allows requests for a manually agreed schedule.
- Booking records capture actual work start and finish. An in-progress Hustler can explicitly extend by 5–120 minutes (cumulative max 240) only if the resource pool permits it; changes are audit logged in `BookingScheduleRevision` and the Client receives a booking-state notification. No financial amount changes. A schedule extension never initiates collection, settlement, refund or payout.
- Median duration of up to 25 completed bookings produces an owner-only suggestion after five observations; does not override the configured default.
- Additive Prisma migration and types, no applied DB changes from this PR.

## Current scope boundaries
1. **Automatic time extensions and background delay alerts are NOT activated.** `autoExtensionMinutes` is stored for future policy execution, but extensions in this milestone are manual, deliberately confirmed, auditable and capacity checked.
2. No explicit roster, employee identity, chair/table allocation or per-worker calendars yet; shared resource pools model aggregate capacity. Do not claim real restaurant table assignment or staff rescheduling.
3. `weeklyHours = null` is a legacy compatibility setting: restrictions are not enforced; the UI's default 9am–6pm slot preview is indicative. New Services get a configurable 8am–9pm Monday–Saturday example, and operators must intentionally save accurate windows.
4. Structured appointments must fit a single business-local calendar day including buffers. No overnight shifts in this first version. Changes to time zones or service capacity may affect new requests; already confirmed bookings are not silently modified.
5. Availability is checked against current Bookings. No temporary reservation/expiry or payment-hold mechanism is introduced; `PAYMENT_PENDING` occupies configured capacity until explicit transition.
6. Controlled overbooking is OFF by default; enabling it allows explicit extra capacity with a warning. Appointment collisions are checked by overlapping *intervals* with setup and recovery buffers.
7. Slots use an IANA time zone to render local business start times. Clients see human-readable times; no other user's identity/requirements/notes are disclosed.
8. No live Supabase database migration, production deploy, actual payment, deposit, provider custody or genuine signed-in two-account staging run was executed automatically.

## Owner-reviewed migration gate
- Verify a recent database backup/recovery option and review the SQL migration under `apps/api/prisma/migrations/20261015122500_flowtime_adaptive_booking/migration.sql`.
- Confirm rollback strategy (this migration adds columns, enum, table and indexes; don't drop columns on a database with newly written FlowTime data).
- Run `npx prisma migrate status --schema apps/api/prisma/schema.prisma` against the approved target before applying any change.
- Apply `npx prisma migrate deploy --schema apps/api/prisma/schema.prisma` only after explicit owner approval, during a coordinated API deploy. Older API deployments must not be pointed at schema columns before migration.
- Run exact-head GitHub Foundation, Isolated Payment Sandbox and MONIFlow handshake workflows.
- Test two disposable authenticated accounts: Service schedule changes, available/full/blackout slots, simultaneous requests, accepted reservation, independent second worker capacity, queue saturation, extension without price change, both parties notified, safe decline/cancel, payment boundary.
- Exercise three overlapping accept calls with **real PostgreSQL** while monitoring transaction lock behavior; in-memory tests are not evidence of cross-process concurrency safety.
- Repeat mobile 320–390px and desktop Chrome smoke, physical mobile Safari/Android, and verify existing free/paid funding transitions.

## AED
Build → Shadow: use genuine booking/outcome measurements before automatically adjusting predicted work duration, allowing automatic extensions or changing normal appointment buffers. User trust and accurate commitments outrank maximal booking density.
