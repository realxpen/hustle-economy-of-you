# UX009 — AWS to Regular Cloudflare Staging: Cutover Acceptance Gate

**Status: DRAFT — NOT APPROVED TO DEPLOY**

## Exact scope
The new, separately gated manual workflow may update only the **existing nonproduction** `hustle-ios-pwa-staging` Cloudflare Worker from the existing Vercel isolated API to the verified AWS Lambda API. The independent `hustle-ios-pwa-aws-test` Worker remains operational. The default regular-staging build and the existing manual Vercel staging workflow remain unchanged as a rollback route.

Both staging services reference the **same disposable Neon child**: `summer-sound-54525078` / `br-dark-sunset-zay33p1s` / `hustle_staging`. This is not production, a new DB or a separate financial ledger.

## Evidence on 26 October 2026
- Founder reports complete Client/Hustler iPhone flows passed: proposed-time acceptance, simulated deposit, work start, completion, escrow release, verified review and a proposed-time decline.
- Read-only Neon verified the completed accepted-proposal booking, a released ₦200,000 simulated escrow, exactly one balanced payment and release ledger transaction each, and correctly directed scheduling alerts.
- A fresh 5-star `PUBLISHED`, `verifiedTransaction=true` review exists on that booking with a REVIEW notification.
- **Unresolved evidence discrepancy:** child DB contains **zero** `timeProposalStatus='DECLINED'` bookings and only two completed bookings. Founder-report is recorded; authoritative declined-proposal persistence is **not independently confirmed**.
- AWS Lambda and AWS iPhone preview deployment runs `40323058270` and `40325659759` succeeded.
- Signed-in API wallet reconciliation, Client release CTA persistence, duplicate-review rejection, notification/session cross-user isolation and post-transaction Lambda error logs must still be explicitly certified.

## Implementation safety
- Default build: Vercel (unchanged).
- Parallel preview build: separately named AWS test Worker (unchanged).
- `HUSTLE_STAGING_AWS_CUTOVER_BUILD=true`: only the regular staging Worker points to the fixed, known AWS backend; retains its ordinary PWA manifest and identity.
- Simultaneously setting the two AWS build flags fails. Arbitrary backend URLs are never accepted.
- New workflow is `workflow_dispatch` only, branch `main` only, exact repository only and protected by `hustle-cloudflare-staging` environment; explicit confirmation: `I_AUTHORIZE_AWS_STAGING_CUTOVER_ONLY`.
- New and original regular staging workflows serialize on `hustle-cloudflare-isolated-staging` concurrency.
- Workflow preflights isolated Lambda health 200, authentication denial 401 and real-payment initialization denial 403 before deployment.
- No schema change, database role change, production credential, provider activation, ledger mutation, real payments or production deployment.

## Required release gate
1. Reconcile the founder-reported **decline** against the correct test child using a distinct disposable booking; confirm unchanged requested slot and `REQUESTED` status, recipient-only alert and no ledger mutation.
2. Validate only one verified review per booking, no duplicate release, balance shown in the signed-in API, session refresh/sign-out and per-user notification isolation.
3. Check Lambda application logs and any warnings after the actions; account quota remains 10 concurrent executions.
4. Require passing Foundation CI and Cloudflare Compatibility CI and reviewed PR.
5. Founder reviews and approves merging this PR; merge does **not** deploy.
6. Only after explicit second approval, use GitHub Actions → **Hustle Cloudflare Regular Staging AWS Cutover (manual only)** → main → `I_AUTHORIZE_AWS_STAGING_CUTOVER_ONLY`; approve protected environment.
7. Re-test normal staging sign-in, Activity, booking, simulated wallet, reviews and rollback readiness.

## Rollback without database changes
GitHub Actions → existing **Hustle Cloudflare iPhone PWA Staging Deploy (manual only)** → main → `I_AUTHORIZE_ISOLATED_STAGING_ONLY`; approve its protected environment. It builds with the default Vercel backend and redeploys only the regular staging Worker. Verify normal PWA auth, health and signed-in session. Leave separate AWS test Worker operating.

**No action in this PR deploys automatically. No real funds or production are authorized.**
