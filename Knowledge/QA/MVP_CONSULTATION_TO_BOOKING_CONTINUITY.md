# Hustle — Consultation Before Booking, Without Losing the Opportunity

Date: 2026-10-15
Status: Consolidated feature in review branch. **Automated CI and owner review required. Signed-in staging execution remains pending.**

## Baseline and user problem

PR #119 merged into `main` as `3010fb247f75ce335ba203c12d8eef3a3ec0e39d`. It persists an unsubmitted Booking draft in the same browser tab for up to two hours. The existing `Message first` and `Consult Hustler` links opened a service-context thread, but had **no one-click navigation back to the prepared Booking**. Users had to retrace the journey.

## Functional delivery

- On a public Service, **Message first** now opens the existing authenticated Service-context conversation with a safe `returnTo` link to **Book this Service**; any valid proof-Post attribution survives.
- On an already prepared Booking, **Consult Hustler** preserves the exact canonical Service and source-Post return URL. Fields continue living **only** in the prior two-hour tab-scoped draft, not in messages, the URL, or the backend.
- The existing `/messages/start` flow retains the safe return link through direct-conversation creation and only offers `Continue booking request` for a matching Service context, not an unrelated Service ID.
- The existing conversation page presents a return action and draft-specific explanation. It does not claim the draft is a funded, submitted or approved Booking. If the session expires while opening a thread, it carries the safe conversation destination through the auth return flow.
- The shared return-path validator preserves existing authorized Booking/Order detail returns but additionally allows only `/bookings/new/{serviceId}` and (optionally) a single, well-formed `sourcePost` query parameter. It rejects external links, fragments, path traversal, unexpected query fields and unbounded IDs.
- **No** automatic sending of messages, Booking POST, charge, release, payout or wallet movement.

## Automated acceptance included

- Foundation CI now executes the actual TypeScript return-path policy through compilation and asserts valid/invalid paths, context-match guards and component wiring.
- Existing local Chromium public Service → Booking regression now checks that each consultation CTA preserves the canonical Service and a return-to-Booking link without backend mutation.
- Existing draft storage tests, build/typechecks, isolated PostgreSQL sandbox and MONIFlow handshake remain unchanged.

## Live acceptance still pending

- [ ] Final-head three workflows green on the same commit.
- [ ] Owner reviews consolidated PR.
- [ ] Approved nonproduction Client starts a Booking, types a draft, consults an approved Hustler, exchanges a real staging Message and presses **Continue booking request**, seeing the same draft and Service.
- [ ] Confirm same-tab behavior on desktop and mobile browsers; intentional new tab/browser session does not promise restoration.
- [ ] Verify a successful staging Booking POST clears the draft; no real payment or financial provider activity.
- [ ] Production money movement, lawful custody, refunds and payout gates stay separately blocked.

AED sequence: Experience → Build → validate local UI and integration → approved staging System Activation → real Shadow observation. Passing source/Chromium checks is not a claim that the signed-in staging journey has been executed.
