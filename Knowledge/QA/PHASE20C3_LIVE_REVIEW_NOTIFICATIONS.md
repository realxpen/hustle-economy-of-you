# Phase 20C3 Live & Verified Review Notifications QA

Status: development branch, CI and Monday owner acceptance pending.

## Isolated automated tests
- [ ] Actual canonical paid/completed Order creates an authorized verified Review and one Seller alert.
- [ ] Seller self-review, Buyer duplicate Review and their alerts are denied.
- [ ] Followed LIVE host start sends one follower notification; host self-alert denied.
- [ ] A bilateral UserBlock edge excludes blocked followers even with a UserFollow relationship.
- [ ] Second start fails; no duplicate LIVE alert.
- [ ] No schema migration, ledger/payout/reputation shortcuts, or production writes.
- [ ] Foundation CI and isolated payment sandbox checks pass on final PR SHA.

## Monday user acceptance — no testing during weekend
- [ ] Follow an active published Hustler. Starting a new LIVE session sends exactly one Activity alert with valid Live detail link.
- [ ] A blocked user receives no alert; self-start and repeat start never spam.
- [ ] Publish a legitimate transaction-backed verified Review after an isolated test Order completes. Reviewee sees one alert leading to the proper Order.
- [ ] Denied/duplicate Review produces no new alert; notification read/unread and existing Message grouping still work.
- [ ] Owner authorizes correct deployments separately; runtime results logged against deployed SHA.
