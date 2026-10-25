# UX006 — Verified service reviews complete Hustle's opportunity loop

**Status:** Proposed source changes; not merged, deployed, or proven on the hosted iPhone PWA.
**Scope:** Isolated Cloudflare iPhone PWA + isolated Vercel API on the disposable Neon child branch. Production is unchanged.

## User journey

1. A Client discovers a published service and books the Hustler.
2. The Client simulates payment in HUSTLE_SANDBOX; the Hustler simulates work; the Client releases the escrow.
3. The completed booking screen checks `GET /reviews/eligibility/BOOKING/:id` with the Client's staging session.
4. Only a completed booking with an applied signed payment and a released escrow can receive one immutable 1–5 star, 10–2000-character Client review. The existing ReviewService transaction enforces authority, self-review, previous Agent relationship, duplicates, refund and dispute checks.
5. Publishing updates the Hustler's aggregate reputation, emits a verified-review notification and makes published review text available on the published storefront and service offer.
6. The PWA clearly labels all staging reviews and payments as simulations; a sandbox review is not a verified real-world job.

## Changes

- Connect existing Better Auth same-origin `lib/trust` reads and review publication to the iPhone PWA.
- Add exact staging-only route allowlists for authenticated booking review eligibility and individual reviews, a POST `/reviews`, and a GET public published-Hustler trust summary.
- In the staging controller, reject ORDER review publication. No checkout/fulfillment for Orders is enabled.
- Mount `ReviewEligibilityCard` for the completed Client booking, including refresh after escrow release.
- Keep `PublicReputationPanel` visible with a TEST-only label and show verified aggregate/review preview on service detail.
- Extend disposable payment PostgreSQL acceptance for escrow-held denial, release-to-review, duplicate denial, outsider denial and public aggregated proof. Add a mocked PWA proxy/CSRF and allowlist regression in Foundation CI.

## Hosted activation gate (not in this PR)

The Neon child branch (`summer-sound-54525078` / `br-dark-sunset-zay33p1s`, DB `hustle_staging`) currently gives `hustle_api` only SELECT on `Review` and `UserReputation`. After review/merge and before enabling the hosted UX006 flow, verify the exact child and the existing `hustle_child_api` member role, then grant only:

```sql
GRANT SELECT, INSERT ON TABLE public."Review" TO hustle_api;
GRANT SELECT, INSERT, UPDATE ON TABLE public."UserReputation" TO hustle_api;
```

Do not grant DELETE or change row-level-security policies. These grants are **not** required for the ephemeral CI PostgreSQL sandbox, where the existing reviewed migration roles apply. Do not modify production or parent-branch credentials.

Release requires the founder's normal PR review and separate manual Cloudflare staging rollout plus the isolated API deployment of the **same** reviewed merge SHA. Live iPhone tests should verify Client authorship, no duplicate reviews, preview after submission, Hustler notification and public profile rating. Runtime errors or API 403/500 mean the hosted milestone is not accepted.

No live payments, external providers, account role-switching, or production reputation migration are authorized here.
