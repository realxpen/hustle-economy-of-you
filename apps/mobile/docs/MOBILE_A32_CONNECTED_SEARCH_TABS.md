# Hustle Mobile A3.2 — Real connected Search tabs and cursor pagination

**Date:** 2026-10-22
**Runtime acceptance: PENDING.** This is a code/cloud-validated mobile slice. No private test account, deployed API or real Android handset was used, and **No Expo APK** has been generated or approved.

## Knowledge and decision alignment

Existing accepted [ADR-0008](../../../../Knowledge/Decisions/ADR-0008-search-and-marketplace-query-architecture.md) defines **Top, People, Posts, Services, Products** as canonical Search tabs, using published PostgreSQL records with backend ranking and deterministic cursors. Connected mobile A3.1 corrected its source-shaped result types and canonical read-only web page links. A3.2 makes those already authoritative tabs accessible on the connected mobile Explore screen.

The earlier A1–A2.9 offline, fictional Experience is separate, still available for rollback, and must not be confused with the signed-in mobile/API path.

## Specification

- Five horizontally scrollable, 44dp-minimum selected tabs: Top, People, Posts, Services, Products. Tab change runs **the matching backend /search/:tab** with current query and does not privately slice or re-rank mixed Top results. Top continues to use /search.
- Text submission and skill-chip selection reuse the same search function. Blank queries do not call APIs.
- Switching tabs invalidates a prior in-flight search; editing query invalidates current search, empties stale results and resets cursors. Current request sequence guards the result, error and loading writes.
- Each response displays actual canonical record labels via A3.1. No invented providers, popularity/rating, distance, booking availability or checkout.
- Pagination uses the server's `nextCursor` and `hasMore`, with explicit accessible Load more action rather than unbounded background fetching.
- Append results preserving server order and dedupe by `kind:id`. If more results fail, preserve prior cards, show a retry action, and do not fake an empty success.
- Search tabs and requests remain session-local; the Supabase/connected NestJS authentication pathway and published eligibility controls are unchanged.
- Public result links remain guarded by existing canonical-path and configured-web-host checks. No new posts, user accounts, logs/events, backend writes, migrations, secrets or financial activity.

## Architecture and experience

`apps/mobile/src/experience/feed-api.ts` owns `SearchTab` and `searchTabPath`; all queries go through existing authenticated `api`. `MobileExperience.tsx` holds query, selected tab, cursor and request sequence, and composes existing result cards. `src/ux004/discovery/connectedSearchPagination.ts` is pure and only appends previously unseen canonical IDs. No new runtime packages, geolocation, ML search, ranking implementation, or navigation framework.

The accepted **hybrid dark Feed / warm light Explore** aesthetic remains unchanged; tabs are warm-light tactile chips with clear selected state. Cursor loading is deliberate and offers explicit retry.

## Executable cloud QA

`apps/mobile/scripts/mobile-a32-search-tabs-contract.cjs` executes the actual TS route builder and duplicate-append helper, asserts all five real NestJS tab names/routes, query and cursor escaping, stable order, no mutation and distinct kinds with overlapping IDs. It also verifies source-level request-sequence invalidation, tab semantics, 44–48dp hit targets, empty/retry and booking-disable boundaries. It is imported by **mobile-experience-contract.mjs**, already run by Mobile Cloud CI and the separately owner-dispatched EAS preflight; no root CI files are touched. A3.1 and all previous UX004 checks remain.

## Manual connected runtime acceptance (not performed)

| Scenario | Expected |
|---|---|
| Sign in with an authorized nonproduction account, search "tailor" | Top shows ranked published records from real API; no synthetic demo results |
| Tap People / Posts / Services / Products without clearing input | Each tab calls real `/search/:tab`; only correctly typed published records appear |
| Change tabs quickly during slow network, or edit input before response | Old request never replaces new tab/query results |
| Search a term matching over 16 records | Load more appears only if server returns cursor and hasMore; new results preserve rank |
| Pages contain overlapping canonical IDs | Duplicate kind+ID not shown; distinct entity types with same ID remain distinguishable |
| Request a later page then change tabs | Stale page never contaminates different tab |
| Later-page network failure | Existing results remain; the same nextCursor is retriable |
| Unknown term, missing public WEB URL, no GPS | Truthful empty state, no fake link/ratings/distance |
| 320dp Android, enlarged text, keyboard and TalkBack | All five tabs scroll/reach, have selected state, and Load more stays reachable |
| API down / unauthenticated / logout | No fabricated results or unauthorized calls; server errors are not treated as success |

Record exact commit/run, deployed staging API URL, device/OS, screenshots, auth state and manual PASS/FAIL when a future runtime test is approved. Free cloud compilation does not certify any such runtime behavior.

## Deployment-control acceptance

This PR changes **only `apps/mobile/**`** to test Vercel's recently requested “Skip Unaffected Projects” optimization for `staging-hustle-api`, `staging-hustle-web`, and `admin`. Expect those three Vercel projects to be **skipped** if the Vercel setting is actually effective. Do not claim it works without inspecting PR statuses. Do not trigger paid Vercel builds or an Expo APK to verify this.

## Owner gates

Owner review and manual merge only after exact-head Mobile Cloud CI, Foundation CI, and free native Android Gradle succeed; investigate any unexpected Vercel deployment attempt or limit separately. No automatic deployment, merge, production DB activity, payment activation or device acceptance.
