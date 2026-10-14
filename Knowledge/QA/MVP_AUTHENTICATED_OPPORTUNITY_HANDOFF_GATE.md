# Hustle — Authenticated Opportunity Handoff (Consolidated Milestone)

Date: 2026-10-14
Status: **Implementation in one PR. CI and deployed signed-in acceptance are separate gates.**

## Why

Hustle must convert discovery into business opportunity. Existing Public Service → Booking and Service → Message links already work as entry points, but the auth UI previously sent **every successful login** to `/account` (or `/onboarding`), discarding a Client's shared Service/Booking intent. An email callback also accepted an arbitrary `next` URL, which could redirect externally after authentication.

## Integrated scope

1. **Strict shared destination policy** — A pure TypeScript helper accepts only explicit internal Hustle paths for Service, Booking, Message/consultation, profile and marketplace actions. It rejects protocol/external links, nested auth routes, encoded separators, control characters and overlong values. Used on browser *and* auth callback server.
2. **Sign-in / phone OTP** — After the existing genuine Supabase sign-in and backend account sync, users with completed onboarding return to their original allowed Hustle destination.
3. **Sign-up / email confirmation** — Confirmation URL carries an encoded allowed destination; the server callback directs to onboarding with a safe `next` value. A new Client completes the original profile onboarding before continuing.
4. **Booking request** — If the genuine authenticated availability/booking request says sign-in is necessary, return to the Booking form, keeping the Service ID and permitted source-post query. User-entered unsubmitted form fields are *not* persisted.
5. **Service-context consultation** — The existing Message Start route preserves recipient and context through the auth flow instead of dropping them to a generic login.
6. **CI safety gate** — Runs the actual helper through TypeScript-to-JS compilation and direct assertions for valid and malicious return destinations. Source contracts guard the API-to-client handoffs. Existing Chromium public Service/Booking interaction and Postgres/finance CI remain unchanged.

## Acceptance scenarios (still need an approved nonproduction environment)

- [ ] Existing Client opens a real shareable Hustler Service from outside Hustle, chooses Book, signs in and lands on the *same* Booking request.
- [ ] New Client from that link signs up and confirms email, completes onboarding and returns to that same Booking request.
- [ ] Returning Client opens Message first, signs in and retains Hustler recipient and Service context.
- [ ] Auth callback `?code=...&next=//evil.example` cannot leave Hustle; failed/no-code callback cannot redirect arbitrarily.
- [ ] Real approved Hustler publishes Service and proof Post; real Client discovers, consults and books; Hustler accepts in a separate authenticated account.
- [ ] Repeat desktop/mobile browser and iOS Safari/Android acceptance with user-authorized test accounts. Do not use personal or production financial information.

## Not claimed by this PR

No automated **real signed-in Supabase** flows, production/browser deployment, account-approval evidence, live BMONI merchant/escrow powers, real payments or escrow custody. The strict redirect unit test is not an authentication integration test; the local browser test remains a synthetic public-Service UI test.

## Go/no-go

Merge this consolidated milestone only after exact-head CI and owner review. Live signed-in acceptance requires approved staging auth configuration and test accounts. Real-money activation requires independent PSP, authorization and legal custody evidence.
