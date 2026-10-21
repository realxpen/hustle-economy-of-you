# Hustle UX004-A2.6 — Content-aware offline Explore search

**Date:** 2026-10-21
**Device acceptance: PENDING.** This is source and free-cloud validation only; there is no available owner Android emulator / phone acceptance for A2.
**No Expo APK** or production deployment was requested or triggered. A1's previously accepted APK stays untouched as a rollback reference.

## Problem

The fictional Explore previously searched a narrow set of names, professions, offer titles and sample places. A person trying to find a creative result through the proof itself — "fade", "two-piece", "portrait" or "spice" — could miss relevant providers even while the work's Feed caption described that exact capability. Hustle is a capability-and-content-first ecosystem, not only a static provider directory.

## Scope

- Add one small **pure, local** filter that searches name, handle, profession, place, category, caption, artwork headline/slogan, and attached sample offer title/detail.
- Search is case-insensitive, trims/collapses whitespace, and requires every query word to be present somewhere within a single post's fields. It intersects the existing skill category chips and **preserves fixture order**; no ranking, location services, backend search or fake recommendations.
- Explore lists the matching fictional professionals with their existing price plus up to two lines of the existing content caption as a sample proof-of-work preview.
- Add a count labeled **fictional results · Local sample work** and a visible accessible Clear control for search input.
- No matches produces a clear explanation and a minimum 48dp **Clear search and filters** action. No hidden search history, analytics, sign-in or personal data.
- Preserve PR #162's independent **See work ↗** and sample profile actions and the existing Feed page/index restoration. Search/category state remains local through normal tabs.
- No offer, comment, collection, like, modal, navigation architecture or production financial-system changes.

## Executable cloud acceptance

The new UX004-A2.6 Node regression loads the **existing TypeScript selector** and parses the **actual four literal Feed fixtures** from DemoExperience.tsx, then asserts that queries such as "sharp fade", "sketch outfit", "portrait edits", "signature spice", "chef.amara", and "Surulere" resolve correctly. It covers multi-word matches, negative matches, case/whitespace normalization, category intersections, retained source order and immutable fixtures.

Source guards also verify new React Native accessibility labels, state restoration, two-line caption snippet, empty-state reset, all prior A2 controls, no API/payment coupling, and the separate owner-approved manual Expo gate.

This contract runs in Mobile CI and in the **preflight** portion of the existing manual Expo workflow. Foundation CI, Android Metro, TypeScript and free native Android Gradle remain separate required PR checks.

## Deferred device QA — not run

| Test | Expected |
|---|---|
| Enter "fade" then select Beauty | One matching fictional barber with a short sample-work description and working See work button |
| Enter "portrait edits" | Matching photographer despite terms from different work/offer fields |
| Enter "spice" then choose Fashion | Clearly shown zero results; clear filters restores all four |
| Tap Clear within search field | Text resets; skill chip remains selected |
| Scroll, filter, open a matching work post, return to Explore | Correct Feed post, original Explore query and skill state preserved |
| Compact Android width, enlarged font, TalkBack | Result count, clear buttons, sample text and independent card actions do not overlap or lose focus |
| Offline airplane mode | No live location, search API, media stream, real provider or transaction |

The owner may review/merge after **all cloud workflows pass**. Physical phone/Waydroid/TalkBack and gesture QA remain **PENDING** until real access exists, and are not inferred from source assertions. Any fresh Android demo APK requires its own owner approval.

## Product boundaries

Only existing fictional sample content, no new assets/packages, permission scopes, geo APIs, native module changes or backend/payment integration. No automatic merge or Expo build.
