# Hustle Mobile — Content-to-Booking Integration Gate (2026-10-17)

## Scope
Branch: `feat/mobile-content-feed-interactions`. Figma: https://www.figma.com/design/psxnn95X8nPqEEp7IvEw5s?node-id=2-18

Implements Expo mobile Home video feed, Explore search, signed-in Supabase session handoff, authenticated Nest feed pagination, verified published-media URLs, like/save/follow/comment/reply mutations, share sheet, creator preview, service/product attachments, and read-only booking slot availability.

## Binding protections
- Existing `App.tsx` Supabase signup/signin, account sync, session listener and signout stay in place.
- User remains one account. No role switcher.
- The API returns real published posts. No invented creator, reviews, verification, media, inventory or prices.
- Only truthful contact verification is displayed; no ungrounded Hustler trust badge.
- Empty/loading/error and missing-media states are explicit.
- Native sharing includes a post URL **only** if `EXPO_PUBLIC_PUBLIC_WEB_URL` is configured to an actual valid Hustle public web origin.
- Named collections and Live streaming are not claimed as active.
- Booking reads `GET /bookings/slots` and only shows server-available appointment slots.
- `POST /bookings` is **disabled by default**, unless `EXPO_PUBLIC_HUSTLE_ENABLE_BOOKING_REQUESTS=true` in an owner-approved nonproduction environment; a second explicit confirmation is required.
- No payment collection, escrow, payout, production migrations, provider callbacks or live commerce activation.

## API contracts read
- `GET /api/v1/feed/:tab` — `for-you`, `nearby`, `connections`; page has `items`, `hasMore`, `nextCursor`.
- `GET /api/v1/search?q=...` — authenticated result discovery.
- `POST/DELETE /api/v1/posts/:postId/like` and `save`.
- `GET/POST /api/v1/posts/:postId/interactions` / `comments` (comment GET is interactions, comment POST is comments).
- `POST/DELETE /api/v1/users/:userId/follow`.
- `GET /api/v1/bookings/slots?serviceId=...&date=YYYY-MM-DD`.
- `POST /api/v1/bookings` (feature-gated, REQUESTED only).
- `POST /api/v1/feed/events` for read telemetry.

## Required local checks before approval
1. Reconcile root `package-lock.json` with the new Expo dependencies using the repository-approved package manager; do not merge until `npm ci` works.
2. Run `node apps/mobile/scripts/mobile-experience-contract.mjs`.
3. Run `npm run typecheck --workspace=@hustle/mobile` and the existing `npm run ci`.
4. Start `npm run dev:mobile` using a nonproduction backend and configured Expo public variables; test an actual iOS/Android device.
5. Sign in and restore session; verify role/capability model, signout and expired-session behavior.
6. Feed: swipe videos, pause inactive videos, reach last item and fetch next cursor, switch For You/Nearby/Following, test empty/error/network retry.
7. Like/unlike, save/unsave, follow/unfollow; reload each and confirm server persistence. Post/reply on comments and confirm visible threads.
8. Share a post only with a configured real public web URL.
9. Open an attached Service from video and inspect actual API slots; check timezone labels, no slots and closed availability.
10. With booking feature flag **unset**, verify no POST request is issued. In approved nonproduction only, enable it and verify explicit human confirmation, server REQUESTED status, duplicate prevention and rejection of unavailable slots.
11. Test slow networks, Android back, tap targets, keyboard, small viewport, accessibility and video unload behavior.

## Current evidence and blockers
- Figma: existing 20 hotspot navigation reactions saved, no full prototype/device acceptance claim.
- API route signatures and response shapes inspected from GitHub main.
- No local device execution or actual signed-in API calls performed by this assistant.
- The development environment cannot reach npm/GitHub hostnames from its container; package lock refresh and executable CI/devices remain unverified.
- Production activation is explicitly out of scope. `PROJECT_STATE.md` continues to block real funds, provider rails and unsafe production migrations.

## Human gate
Owner approves Figma flow and nonproduction tests, then reviews CI and explicitly decides whether to merge. Never interpret PR creation or mocked UI as real ecosystem activation.

## CI run observed (2026-10-17)

GitHub Foundation CI run `39051143792` failed at step 4, `Install locked dependencies` (`npm ci`, `EUSAGE`) before mobile typechecking. The logs report missing locked versions including `@expo/vector-icons@15.1.1`, `expo-video@3.0.16`, `react-native-safe-area-context@5.6.2`, plus numerous Expo transitive packages. Regenerate the **complete root npm lockfile** with a live registry on a trusted development machine and commit it to this PR; manually inserting three lock entries is not sufficient. Re-run CI afterward. No mobile build, device, authentication test or booking request is proven successful by this run.

## Cloud-only delivery process (2026-10-17)

No local installation or command-line work is required from the owner. GitHub Actions cloud workflow `.github/workflows/mobile-cloud-validation.yml` reconciles the npm lockfile in the review branch and checks mobile dependencies, source contracts and TypeScript. Subsequent standard Foundation CI runs are cloud-only as well. Production/live device acceptance remains a separate gated requirement.
