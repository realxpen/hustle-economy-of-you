# Hustle UX004-A2.5 — Explore to Feed proof-of-work navigation

**Date:** 2026-10-21
**Device acceptance: PENDING.** No Android emulator, Waydroid or physical phone QA is available at this stage.
**No Expo APK** has been requested, queued or approved for A2.5. Previous owner-accepted A1 remains the rollback APK; passing cloud checks cannot recertify any A2 screen.

## Problem and small UX decision

Hustle's core story is capability demonstrated through content, not a generic directory. The existing fictional Explore screen listed four sample professionals, but tapping a listing led only to a sample creator sheet. There was no obvious way to go directly to that person's corresponding work in the immersive Feed. This slice closes that isolated preview-journey gap.

## Implemented

- Each Explore result now has two independent, non-nested actions: **open sample profile** and **See work ↗**. Each action has its own accessibility label; See work has a hint saying it opens a fictional illustrated sample in For You.
- When Explore opens the sample profile sheet, a secondary **See sample work in Feed ↗** button also leads to the right post. The existing offer-preview button stays.
- A small pure ID-to-index resolver finds the target in the *same four existing fictional Feed posts*. Unknown identifiers safely do nothing.
- The handoff explicitly clears saved-only/selected collection, closes the sheet, selects the corresponding Feed index, records that normal Feed index, and enters Home → For You. This is not an external deep link.
- Home is unmounted while Explore is showing; the existing initialScrollIndex and measured pageHeight select the destination on remount. No new navigation dependency or imperative scroll command.
- Preserve the original four fictional posters, captions, comments, collections, Likes, preview-only product/service offers, nav, Android Back and keyboard ownership.
- No new content, APIs, location lookup, uploaded media, profile verification, identity, booking, payments, or production changes.

## Automated gate

The source and behavior contract runs the real pure helper against all four actual post IDs extracted from the demo TSX and asserts correct index/unknown ID/no mutation. It also guards independent Explore tap targets, creator-sheet continuity, Feed initialScrollIndex, sample disclosures, and manual Expo preflight. It runs after A2.4 in Mobile CI and remains part of the gated manual APK workflow.

## Device testing to perform only when access returns

| Journey | Expected outcome |
|---|---|
| Explore → search fashion/barber/food/photography → See work | Correct sample Feed post opens immediately, not another creator |
| Explore → sample profile → See sample work in Feed | Opens corresponding sample post; sheet closes |
| Explore → sample profile → View service/product | Existing preview-only offer sheet still works |
| Choose View work after visiting a saved collection | Opens full For You, not the filtered collection |
| From chosen work, swipe once, then switch Explore → Home | Normal Feed index remains consistent |
| Small 320dp layout and font enlargement | Independent buttons do not overlap or truncate crucial names/prices |
| TalkBack | Profile versus See work are separately reachable and clearly labeled |
| Offline airplane mode | No API, real maps, actual provider, booking, purchase, payment or live-media activity |
| Android Back / gestures | Correct keyboard-sheet ownership and no broken back-to-home behavior |

Record actual APK/build ID, Android version, device type, screenshot/reproduction, PASS/FAIL and owner sign-off later. **This remains pending**, even when cloud CI is green.

## Boundaries and approvals

Review and merge this code separately on a small PR only once cloud Mobile, Foundation and free native Android Gradle diagnostics pass. Device acceptance is deliberately deferred and is *not* a requirement to continue independent cloud-only slices. **No Expo APK build** or production deploy may be started automatically. This does not change Hustle's real marketplace implementation.
