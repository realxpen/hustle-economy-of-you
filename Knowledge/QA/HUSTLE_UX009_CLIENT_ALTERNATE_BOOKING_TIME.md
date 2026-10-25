# UX009 — Client decision on Hustler-proposed alternate booking time

## Incident (iPhone AWS preview)
The Hustler selected **Suggest alternate time in Messages** on a `REQUESTED` booking. This only sent a plain consultation text. The Client had no structured proposal ID, booking action, Activity notification or Accept/Decline buttons. The existing message remains ordinary chat history. It is **not** retroactively interpreted as consent or an actionable proposal.

## Authoritative response flow
1. Hustler opens a `REQUESTED` booking and selects a different future start/end time → **Propose new time to Client**. POST `/api/v1/bookings/:bookingId/propose-time` validates active Hustler role, booking ownership, future slot and provisional availability. The proposed time is persisted in nullable `Booking.timeProposal*` fields; the original booking request is **unchanged**. A recipient-only BOOKING Activity event links the Client directly to the booking.
2. Client opens Activity or My Bookings → booking detail → **Accept proposed time** / **Decline proposed time**. POST `/api/v1/bookings/:bookingId/respond-time` requires the Client's authentication, exact booking, and the exact pending `proposalId`; the transaction uses compare-and-swap to prevent stale or duplicate decisions.
3. **Accept:** the original booking stays `REQUESTED` but its **requested** schedule changes to the agreed alternative; the Hustler receives an Activity event. The Hustler must separately press **Accept requested time**; that final acceptance atomically rechecks/reserves availability and may move to `PAYMENT_PENDING`. No automatic funding, payout, escrow, or work-start.
4. **Decline:** the original requested time remains unchanged and `REQUESTED`. The Hustler gets an Activity event and may accept that original time or propose another. A new proposal overwrites the completed proposal fields; each decision has a unique notification key and full booking Activity trail.
5. While a proposal is **PENDING**, Hustler cannot accept the booking behind the Client's back. The authoritative Nest accept endpoint rejects pending proposals before and during its final state transition, including concurrent race conditions.
6. Client and Hustler see the current proposal and outcome on the booking detail. Client's Bookings list highlights **New time proposed — Accept or decline**. Refresh rereads DB state.

## Migration and strict release order
This is a **backend/schema/Cloudflare coordinated release**; unlike UX007/UX008 UI-only fixes, merging without a staged database and API update is insufficient.

- The single authorized QA Neon project is `summer-sound-54525078`, **disposable child** `br-dark-sunset-zay33p1s`, database `hustle_staging`. Do **not** migrate the parent `staging` branch, production, another account or app DB. Migrations only add nullable fields, a proposal enum and check constraint; no existing booking status or financial data is modified.
- After PR/CI is approved, apply exactly `apps/api/prisma/migrations/20261025214500_booking_time_proposal_response/migration.sql` to that child once. Verify its checksum/schema; Prisma `_prisma_migrations` must also be tracked by proper `prisma migrate deploy` on that same branch when able, rather than leaving drift.
- Deploy **AWS Lambda isolated staging API** from merged main via existing manual protected `I_AUTHORIZE_AWS_ISOLATED_STAGING_ONLY` workflow. Confirm health 200, live payment POST 403, and new unauthorized `propose-time/respond-time` POSTs 401, never 404/500. Do not change the current working Vercel API.
- Only **after AWS endpoint acceptance**, deploy independent **AWS iPhone Preview** Worker via `I_AUTHORIZE_PARALLEL_AWS_IPHONE_TEST_ONLY`. Keep `hustle-ios-pwa-staging` pointed at Vercel.
- Client and Hustler should perform the test on a **new disposable REQUESTED booking**, using the named QA test accounts, not the previously completed/released booking. **Previously sent chat-only proposals must be re-sent using the new structured button**.
- Verify two paths separately: Client ACCEPT (then Hustler confirms) and Client DECLINE (original request unchanged). Each path needs a fresh booking/proposal or a new proposal after decline; do not reuse completed simulated escrow.
- After iPhone tests, read-only reconciliation: proposal ID/state, requested time, status transitions, recipient Activity event keys (exactly once), no wallet/escrow activity caused by proposal response, no duplicate commits under retry, no cross-role access.
- Rollback: Leave the existing Vercel PWA untouched. If new API misbehaves, redeploy the previous AWS Lambda image or keep testing on Vercel; additive schema remains compatible with old API.

## Constraints
- Server role checks: active Hustler proposes, booked Client responds. Both endpoints require the existing AuthGuard and exact staging allowlists.
- Unauthenticated user receives 401, wrong role 403, outdated/duplicate proposal 409, invalid/past schedule 400/409. UI disables duplicate taps and shows server conflicts rather than changing labels locally.
- No production payment providers, real deposits, custody, withdrawals, escrow releases or production data are involved.
- Technical assertions run in Foundation CI: `node scripts/experience/check-ux009-client-booking-time-proposal.cjs`. Live two-identity acceptance still needed.
