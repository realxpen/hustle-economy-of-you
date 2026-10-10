# Phase 20C3 Live & Verified Review Notifications QA

Status: PR #80 MERGED (`f78f9e6919a69ada5c267681ea3edc32af281b7e`), 2026-10-10. Foundation CI `38041849418` and isolated payment/Live/Review CI `38041849387` PASSED. No migration, no production deployment. Monday owner runtime acceptance remains pending.

## Isolated automated tests
- [x] Actual canonical paid/completed Order creates an authorized verified Review and one Seller alert. (isolated GitHub Actions CI 2026-10-10).
- [x] Seller self-review, Buyer duplicate Review and their alerts are denied. (isolated GitHub Actions CI 2026-10-10).
- [x] Followed LIVE host start sends one follower notification; host self-alert denied. (isolated GitHub Actions CI 2026-10-10).
- [x] A bilateral UserBlock edge excludes blocked followers even with a UserFollow relationship. (isolated GitHub Actions CI 2026-10-10).
- [x] Second start fails; no duplicate LIVE alert. (isolated GitHub Actions CI 2026-10-10).
- [x] No schema migration, ledger/payout/reputation shortcuts, or production writes. (isolated GitHub Actions CI 2026-10-10).
- [x] Foundation CI and isolated payment sandbox checks pass on final PR SHA. (isolated GitHub Actions CI 2026-10-10).

## Monday user acceptance — no testing during weekend
- [ ] Follow an active published Hustler. Starting a new LIVE session sends exactly one Activity alert with valid Live detail link.
- [ ] A blocked user receives no alert; self-start and repeat start never spam.
- [ ] Publish a legitimate transaction-backed verified Review after an isolated test Order completes. Reviewee sees one alert leading to the proper Order.
- [ ] Denied/duplicate Review produces no new alert; notification read/unread and existing Message grouping still work.
- [ ] Owner authorizes correct deployments separately; runtime results logged against deployed SHA.
