# UX-004 — Final MVP experience refinement acceptance

Status: PR #85 MERGED `7c80e8963c278d0685eddcf4be47c19471e3b271`. Final head `5d5ebab389b5bd8fbceac800a3439393e74747f0` Foundation CI `38077085748` SUCCESS. No payment sandbox triggered on UX-004 Web-only changes. No manual acceptance or deployment performed 2026-10-10.

## Automated gate
- [x] Final GitHub Foundation CI `38077085748` green on UX-004 PR head `5d5ebab`: Web/Admin/Mobile/API typechecks and Web/Admin/API builds.
- [x] PR #85 merged only after required checks passed (`7c80e896`).
- [x] No changes to API authorization, database, payment/ledger or existing notification delivery paths in the UX-004 diff.
- [x] UX-004 uses existing ExperienceHeader/ExperienceState and semantic design tokens without adding another role/account model.

## Monday 2026-10-12 owner runtime acceptance (PENDING)
- [ ] Owner-authorized Web deploy at merged main SHA only; confirm deployment SHA after release.
- [ ] 320/360/390/768/1024/1440px screens: Messages inbox, unread/search filters, chat detail, keyboard and file input focus/attachment preview, no composer/dock collision; test keyboard and reduced motion.
- [ ] Message optimistic success/error restore, after-refresh read receipts, authenticated private image/file URLs, delegated Agent provenance and unread counters remain correct.
- [ ] Activity: grouped MESSAGE/post notifications remain one per canonical group, unopened groups unread, other kinds distinct, tabs filter fetched groups only, pagination and read-all remain isolated.
- [ ] Wallet: signed-in ledger values match server across all currencies; pending/escrow/reserved not treated as withdrawable. Under/over available client-side validation and server-side rejection, sandbox provider-confirmed payout status only, unknown reconciliation never shown healthy. **No live money.**
- [ ] Live: no active sessions, reload failure/retry, host room create without auto-broadcast, camera/mic, viewer and pinned real offer navigation; native media and external fallback unchanged.
- [ ] Posts: incomplete draft saves, publish prerequisites, image/video previews, media removal, URL validation, canonical Service/Product reference and public reputation isolation.
- [ ] Agent: invitation / active / revoked scopes, assisted Client owner consent, representative navigation, cross-principal data reset, denied deep links on revoke, full Booking detail and audit attribution. No Agent payouts/completion/review powers.
- [ ] Smoke test Client → Hustler → Agent → Admin content/booking/order/activity flow; use isolated payment sandbox for payment-dependent integration and stop if credentials or production authorities would be touched.
- [ ] Record browser issues, screenshots and pass/fail decisions before declaring UX-004 runtime accepted or MVP release ready.

## Release boundary
Recent Phase20/21 + UX001/002/003/004 code merges are NOT proof of consolidated production runtime acceptance. Owner controls deployments. After this PR, enter MVP stabilization/readiness rather than inventing a further disconnected UX build phase.
