# Hustle Mobile A3.1 — Real connected Explore search contract correction

**Date:** 2026-10-21
**Runtime acceptance: PENDING.** No connected mobile account, private real-person records or device have been exercised by this code-only slice.
**No Expo APK** was queued or approved. The A1 owner-accepted offline demo APK and all UX004 A2.1–A2.9 fictional demo behavior remain unchanged.

## Problem found in actual code

`apps/api/src/search/search.service.ts` has an established published-data-only search read model. Its `publicResult` returns a top-level `{ kind, id, ...result.value, ranking }` object, with e.g. `person`, `post`, `service`, `product`, `owner` and canonical `url` fields. However the authenticated mobile adapter incorrectly declared `SearchResult = { kind, id, value }`, and `MobileExperience` read `result.value`. The mobile UI could not reliably render the actual record's title, type or public route.

The mobile Search chip handler also bypassed its ordinary search handler and allowed late responses to replace more recent ones, and the result rows were not interactive.

## A3.1 focused implementation

- Align only the **mobile read-only type** with the existing flattened backend response. Backend service/controller/ranking/public eligibility remain unchanged; no migrations.
- Add a small pure projection helper for real `person / post / service / product` results. Display source-backed title, category/skill/location/owner details only; do not infer verification, pricing, reviews, availability or transaction permissions.
- Source the public result path from the existing API, but require it to **exactly match** the safe canonical path for the corresponding kind + ID (or person username). Only link if `EXPO_PUBLIC_PUBLIC_WEB_URL` specifies a valid HTTPS site (local `http://localhost` or `127.0.0.1` accepted for developer use); do not invent a host. User taps explicitly to open the public Hustle page in the phone browser. If there is no configured URL, the result remains readable but the link is explicitly unavailable.
- Consolidate search-button and skill-chip requests into one function; increment a sequence number on each new request and edited input. Only the latest request updates results, errors and loading indicators. Clear the previous result list when editing to avoid showing outdated results for a new query. Add a truthful no-matches state and explicit retry. No automatic request while typing.
- Preserve authenticated API boundary, existing published-record eligibility, session ownership, Feed engagement, booking-disabled gate, no payment/messaging writes and offline-demo selector. No new native packages or production changes.

## Automated gates

- New standalone Node contract transpiles and executes the actual pure projection+URL helper against API-shaped **synthetic fixtures**. It reads the **real NestJS SearchService source** to verify flattened response structure, canonical paths and mobile type integration. It checks false/injected or wrong-origin links are rejected; title/skill/category text remains grounded; code paths prevent stale responses; no write integrations or new secret handling are added.
- Mobile Cloud CI still executes all offline demo UX004 contracts, TypeScript and Android Metro export; new A3.1 contract added before TypeScript. The same contract is added to **preflight only** in the separately approved manual Expo demo workflow.
- Free Foundation CI and native Android Gradle diagnostics provide broader regression gates. No source checks prove authenticated runtime correctness.

## Deferred true user acceptance

| Scenario | Expected |
|---|---|
| Sign in to the connected app using a valid nonproduction account and configured test API | Real published search results show truthful People/Posts/Services/Products titles and owners, no demo records |
| Search `tailor`, immediately change to `barber` before first response | Earlier `tailor` response never replaces `barber` results |
| Search while an error response is pending, then edit query | Stale error never appears under a new query |
| Choose a skill chip | One centralized search dispatch; correct input, no old results |
| Search an unknown term | Truthful zero-result message, not fake creators or unavailable-map claims |
| Search API network unavailable | Error plus retry; no empty-success illusion |
| Tap a result with a configured valid public origin | The canonical public People/Post/Service/Product page opens intentionally |
| Missing/invalid public origin or wrong canonical path | The result is readable but cannot open an unsafe/invented link |
| Device accessibility and 320dp width | Search action, result title/subtitle and disabled-link explanation work at larger text/TalkBack |
| No deployed API or authorization | No claims of authenticated runtime acceptance or data connectivity |

Future runtime evidence must record deployed nonproduction endpoints, exact CI commit, signed-in test account authorization, Android build/device and owner PASS/FAIL. **This is not a release authorization**.

## Gate

Owner review and manual merge only once exact-head Mobile CI, Foundation CI and free native Android Gradle pass. Any new Expo build, production deployment, real user login test, transaction authorization, domain config/secrets changes or release remains separately approved.
