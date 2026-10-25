# UX007 — iPhone Activity, review alerts and recipient-only read receipts

**Scope:** Cloudflare isolated iPhone PWA and isolated NestJS API, disposable Neon `hustle_staging` branch. **Not production.** No new payment provider, push service, external messaging, migration, or account-role switching.

## Journey

1. Client finishes a simulated booking and submits its single verified test review (UX006).
2. ReviewService creates a transaction-backed Review and a `REVIEW` notification for the Hustler **inside the same database transaction**. The event is written once.
3. The Hustler opens the same iPhone app and sees an unread Activity-group badge on the existing **You** destination (five-item iPhone navigation unchanged).
4. Hustler goes to **You → Activity & alerts**, reads the review alert and opens the completed booking. The Hustler's booking page links to its own public profile #reviews, showing the published test review.
5. Opening one alert acknowledges only notifications belonging to the signed-in account. Mark all read never touches other accounts. New messages/comments remain collapsed by conversation/post according to the existing Notification service.
6. Expired authentication is handled by the standard auth surface; a momentary 3G/network error shows a retryable Activity error, not a forced redirect.

## Isolation and policy

- GET `/notifications`, `/notifications/unread-count` and POST `/notifications/:id/read`, `/notifications/read-all` are the **only** new staging notification paths. Both the Nest staging gate and the Cloudflare PWA proxy enforce matching exact route patterns; write receipts require same-origin JSON/CSRF protection.
- Controller uses `AuthGuard`; list, unread and read mutations derive `recipientUserId` solely from the verified account identity. The web caller cannot supply or override a recipient.
- The child Neon application role already has SELECT/UPDATE grants on `Notification`; this PR does not change privileges, DB state or schema.
- No direct notification creation endpoint, no notification deletes, no financial mutations or arbitrary href redirects are exposed.
- Alert destinations are restricted to known local application pages.

## Tests and rollout

- Foundation CI: `node scripts/experience/check-ux007-activity-notifications.cjs` verifies exact allowlists, blocked reads/writes, signed-in forwarding, safe pagination parameters, same-origin POST and five-destination badge.
- Isolated Payment Sandbox CI: exercised with a disposable local PostgreSQL payment simulation; verify reviewer cannot mark the Hustler's review alert, recipient can open it, duplicate mark-read is safe, mark-all remains recipient-scoped.
- Follow the project's normal PR merge approval. Deploy **isolated Cloudflare Worker and isolated Vercel API from the same reviewed merge SHA**, then check a real iPhone signed in as Client and Hustler. Do not present a successful CI run as proof of live authenticated UX.

### Live acceptance matrix

- [ ] Hustler opens Activity; review alert appears once.
- [ ] You icon shows unread count; count decreases after opening an alert.
- [ ] Alert opens matching completed booking; `View your public reviews` opens the Hustler's profile at reviews.
- [ ] Mark all read clears the Hustler's unread groups without clearing Client alerts.
- [ ] Reload retains read state; temporary 3G errors show retry rather than a forced sign-out.
- [ ] A guest cannot read another user's Activity; unauthorized requests are rejected.
