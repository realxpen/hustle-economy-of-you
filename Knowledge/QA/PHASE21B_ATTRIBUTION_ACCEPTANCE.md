# Phase 21B Opt-in Attribution — Build & Monday Acceptance

**State:** Feature branch implementation. Automated CI and merged state pending.

## Isolated CI checks
- [ ] Default preference off. GET preference denies unauthenticated requests.
- [ ] Valid authenticated boolean choice required; forged analytics/feed/consent events blocked at legacy public `POST /events`.
- [ ] Pre-consent offer taps remain observational but ineligible for linked outcomes.
- [ ] Real published Post and attached Service click, followed by a genuine Booking for that Service, is counted once under consented Booking associations.
- [ ] Same user taps a published Product in Marketplace and places an Order containing it: one associated Order, with marketplace as latest source.
- [ ] Distinct window and source aggregates returned without user-level data.
- [ ] Opting out removes linked outcomes from Admin summary; repeat opt-in starts a new period without old-click backfill.
- [ ] New post-opt-in offer click and new Booking become newly eligible.
- [ ] Phase21A canonical metrics and isolated payment/ledger/Review/Live tests remain green; no production writes.
- [ ] CI API/Admin/Web/Mobile builds and typechecks green; PR merged.

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
