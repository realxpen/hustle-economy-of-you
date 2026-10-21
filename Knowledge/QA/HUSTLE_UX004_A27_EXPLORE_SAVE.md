# Hustle UX004-A2.7 — Save fictional work directly from Explore

**Date:** 2026-10-21
**Device acceptance: PENDING.** Mobile-cloud and native compilation are engineering checks, not device or TalkBack acceptance. **No Expo APK** build, API connection or production rollout is approved for this slice.

## Experience decision

Hustle's content-first discovery should let people collect demonstrated capability as soon as they recognize valuable work. Previously Explore's fictional result card offered sample profile and See work, but only the Feed offered saving to named collections. A2.7 adds an immediately discoverable, reversible **Save work** action within the same Explore card.

## Implementation

- Each Explore result has separate accessible **Profile**, **See work ↗**, and **Save work** actions. Profile remains the upper card; See work and Save work are sibling controls in a divided row, each with at least a 48dp touch target.
- The save action opens the **existing, proven Save to collection sheet** for that exact fictional post; users can independently check or uncheck **Inspiration** and **Outfit ideas** and finish with Done. This is NOT a new persistence mechanism.
- Both the Explore card and original Feed use the **same in-memory saves map**. After saving, the card shows a filled bookmark and **Saved ✓**. Screen readers get the actual named local collections in the hint and a selected state.
- Empty and multiple-category states are handled by the previous save modal logic. Collections in the You tab still display correct counts, and saved-feed filtering still preserves original post order.
- Explore search/category filters and the prior See work jump retain their states. Comments, Likes, illustrated content and preview-only offer/booking sheet are unchanged.
- The demo stores no records on the server and loses local saves when closed. No auth, API, live media, geolocation, payment, checkout, production or new packages.

## Automated QA

The A2.7 Node contract reads the real four fictional post IDs, executes the existing `selectSavedPosts` pure helper, and tests independent add/remove/union collection behaviors. Static UI contracts verify the targeted Explore save button, accessible status, existing modal state, 48dp touch targets, collection checkbox feedback, prior content-first search and Feed continuity. It runs in free Mobile Cloud CI and the preflight of the **manual owner-approved** EAS workflow; existing older regression contracts continue running.

## Deferred Android/device matrix (NOT RUN)

| Journey | Expected |
|---|---|
| Search "portrait" → tap Save work | Opens the existing Save to collection modal for Kemi's sample post |
| Check Inspiration and Done | Explore card shows Saved ✓; You → Inspiration includes Kemi's work |
| Reopen Save work, select Outfit ideas, uncheck Inspiration | Inspiration no longer contains it; Outfit ideas does |
| Save other results to different collections | Post states independent, original fixture order preserved |
| Tap See work after saving | Goes to matching Feed post with saved bookmark and prior engagement state |
| Tap Profile or Save work in narrow Android viewport (320dp) | Independent, non-overlapping 48dp targets, no accidental profile or Feed navigation |
| Large font and TalkBack | Save work versus See work distinct; saved state and named collections announced |
| Android Back/keyboard/offline mode | Sheet dismisses normally; no network, purchase, booking, or real provider activity |

Record Android build ID, OS, screen width, screenshots, actual PASS/FAIL and owner acceptance only after hardware becomes available. Prior accepted A1 APK is untouched and does **not** certify this slice.

## Gate

Owner review and manual merge only once Mobile Cloud CI, Foundation CI and free Android native Gradle diagnostics pass on the exact PR head. Do not automatically merge, build a paid/quota-consuming Expo APK or claim device acceptance.
