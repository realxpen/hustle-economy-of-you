# Capacity disruption review — 2026-11-01

Build on merged PR #303. Existing client physical-receipt confirmation and ETA revision are retained, not reintroduced.

## Behavior

My Economy → Work reviews reservations with the canonical BookingScheduleService. Removing a chair, losing shift coverage, or changing operating hours can flag previously accepted appointments even when each individual assignment still looks valid. Each review excludes its own reservation and includes all blocking reservations in the owner's shared resource pool, including bookings outside the displayed page. Adjacent appointments use peak concurrency and preparation/cleanup buffers.

Scheduling-only members can read the operations panel and review/reassign appointments. `work.manage` remains required for item progression and ETA changes. Revocation removes access. Free accepted item jobs now expose their permitted progress controls; paid jobs still require funding.

Review pages contain at most 50 reservations, with a cursor to check subsequent pages (including when the current page has no alerts). Upcoming, ongoing and in-progress reservations are covered. Existing roster-disabled workspaces return no review. Alerts are advisory reads; users refresh after roster changes. They do not cancel bookings, change times or prices, release money, or notify customers automatically. Delivery records visibly distinguish provider-recorded handover from the customer's own acknowledgement.

## Boundaries

No schema migration or feature activation. One canonical Booking still reserves one appointment unit and supports one assigned worker. Multiple-worker assignment within a single group booking is NOT implemented by this change. Group tutorial capacity and multi-worker reservations require a separate canonical reservation model; do not imply the UI-preview group model is live backend behavior.

Each reviewed reservation uses the canonical engine's current full pool evaluation. This prioritizes consistency with acceptance rules; the bounded review is not a background scheduler and is not an atomic guarantee of future availability.

## Verification

Local API build, web typecheck, scheduling regression and 49 focused checks passed during development. Disposable PG17 acceptance adds chair-loss/restoration, schedule-only read and mutation denial, revocation and pagination checks; hosted CI status is recorded in the PR. Existing collection/delivery receipt tests verify customer-only confirmation, stale revision denial, idempotency and unchanged financial Booking status. No production, device or hosted authenticated runtime acceptance is claimed.
