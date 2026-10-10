# UX-003 Interaction Polish — automated build and Monday review

**Status:** feature branch, CI and owner Monday runtime acceptance pending.

## Source/code and automated build checks
- [ ] Reusable accessible loading/empty/error state with meaningful action and reduced-motion skeleton.
- [ ] Discover, Search, Marketplace, Messages, Activity, public Storefront and Service/Product detail use shared states.
- [ ] Booking/Order managers show useful retry and empty paths without false role/account switching.
- [ ] Search/Marketplace ignore superseded primary requests and preserve current pagination.
- [ ] Clear filters runs an appropriately reset query and form controls are labeled.
- [ ] Booking form checks end-after-start, explains required data, shows errors and guards duplicate submission.
- [ ] Checkout differentiates preview unavailable/empty/loading, uses autofill and cannot submit empty/unvalidated preview.
- [ ] No stale developer-phase finance guidance and no payment/booking/authorization backend changes.
- [ ] Web/Admin/Mobile/API typechecks and builds green on final commit.
- [ ] PR merged without automatic deployment; existing financial isolated regression unchanged.

## Monday laptop/device acceptance — deliberately not completed
- [ ] 320/360/390px and tablet desktop: touch targets, gutters, scroll, tab bars and no horizontal overflow.
- [ ] Quickly alternate Search and Marketplace tabs while requests are slow: latest results are visible, no stale overwrite.
- [ ] Filter a populated search, Clear filters: results update correctly and no stale filters are submitted.
- [ ] Trigger connection failure, retry and empty states in Discover, Search, Marketplace, Messages, Bookings, Orders and Activity.
- [ ] Verify loading skeleton respects reduced-motion setting.
- [ ] Booking invalid end <= start gives readable actionable error, no Booking created.
- [ ] Booking valid request creates one real disposable request and opens correct Booking detail.
- [ ] Checkout with empty Cart cannot create Order, offline preview can retry, delivery form keyboard/autofill usable.
- [ ] Checkout confirmation remains PENDING unpaid; no live money touched and no fake paid label.
- [ ] Client, Hustler and Agent authorization and delegation unaffected; desktop/mobile nav still operable.
- [ ] Owner manually approves and deploys Web from main before production runtime claims.

Note: Isolated payment, webhook and ledger tests were previously validated and are not the same as Web UI interaction acceptance.
