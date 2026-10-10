# Phase 21A Analytics — Consolidated Acceptance

Status: implementation branch; automatic CI and Monday owner acceptance pending.

## Automated isolated fixture validation
- [ ] Admin Analytics endpoint returns 401 without token; existing AuthGuard and AdminGuard enforce identity and Admin whitelist.
- [ ] Exactly one disposable, completed and verified paid Order is counted once in placed/paid/completed and 1 applied payment.
- [ ] Only transaction-backed published Review increments verified Review, not denied seller self-review or duplicate.
- [ ] Seven-day daily-series totals match the known Order paid and published Review timestamps.
- [ ] Zero Message count with no Message records; observed feed.view is separate from canonical Orders/Reviews.
- [ ] Invalid days value rejected, 7/30/90 accepted.
- [ ] Reading Analytics does not create SystemEvents or mutate any financial/canonical records.
- [ ] Foundation CI for Web, Admin, Mobile, API typecheck and builds green; isolated Postgres CI green.

## Monday owner review (paused until Oct 12)
- [ ] Owner manually authorizes release of **API and Admin** from merged main; verify deployed SHA.
- [ ] Admin-only /analytics loads after login; non-Admin and signed-out access denied.
- [ ] 7 / 30 / 90 day filters, refresh and error/empty/loading states work.
- [ ] Daily timeline, exact-value table, phone/tablet/desktop viewport and keyboard navigation readable.
- [ ] Compare a disposable placed / paid / completed Order + verified Review against respective read-only counts (sandbox paid if needed).
- [ ] No client data exports, revenue claims, synthetic conversion rate or misleading user attribution.

## Exclusions
User-to-event cohort attribution, conversion rates, GMV/net revenue, real-time streaming, A/B evaluation and per-Hustler insights are intentionally future work. This is a read-only marketplace health pulse, not a launch-ready intelligence engine.
