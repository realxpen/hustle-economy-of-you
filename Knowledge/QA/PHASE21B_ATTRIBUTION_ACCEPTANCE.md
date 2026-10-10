# Phase 21B Opt-in Attribution — Build & Monday Acceptance

**State:** PR #82 MERGED (`337763ca88550b865b2855c57d2ef605bd1239ab`), 2026-10-10. Hustle Foundation CI `38049347922` and isolated Postgres/Nest sandbox `38049347924` both SUCCESS on final PR head `f50e6641825e0500d55246eac2c0f37b8e11301c`. No production deployment. Monday manual acceptance pending.

## Isolated CI checks
- [x] Default preference off. GET preference denies unauthenticated requests.
- [x] Valid authenticated boolean choice required; forged analytics/feed/consent events blocked at legacy public `POST /events`.
- [x] Pre-consent offer taps remain observational but ineligible for linked outcomes.
- [x] Real published Post and attached Service click, followed by a genuine Booking for that Service, is counted once under consented Booking associations.
- [x] Same user taps a published Product in Marketplace and places an Order containing it: one associated Order, with marketplace as latest source.
- [x] Seven-day and 30-day aggregate/reporting paths and last-touch source grouping verified; only counts returned, no user-level data. Separate 90-day manual filter acceptance retained for Monday.
- [x] Opting out removes linked outcomes from Admin summary; repeat opt-in starts a new period without old-click backfill.
- [x] New post-opt-in offer click and new Booking become newly eligible.
- [x] Phase21A canonical metrics and isolated payment/ledger/Review/Live tests remain green; no production writes.
- [x] CI API/Admin/Web/Mobile builds and typechecks green; PR merged.

## Monday consolidated laptop review
- [ ] User can see **Account → Optional Analytics** setting, off by default, with an accessible explanation, no dark patterns.
- [ ] Enable on a disposable Client account, click a published Service and create Booking: Admin Analytics displays one relevant consented association with source.
- [ ] Click an unrelated Service/Product and ensure mismatched Booking/Order not associated.
- [ ] Turn off attribution: previously linked outcomes no longer appear; repeat enable does not backfill.
- [ ] Admin page correctly distinguishes observed association from verified conversion rate, revenue, causal impact and total adoption.
- [ ] Non-admin cannot read aggregated reports, and unauthenticated user cannot change anyone's preferences.
- [ ] Validate responsive phone/tablet/desktop states and accessible keyboard operation.
- [ ] Verify production deploy SHAs after owner authorizes API, Web and Admin manual releases.

**Not included:** Consent-based deletion of all historical SystemEvent records, full event-retention policy, deduplicated sessions or third-party attribution across devices. These must be addressed as separate privacy/scale tasks before wider launch.
