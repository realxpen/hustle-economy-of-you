# Hustle UX004-A2.9 — Discover sample work by saved collection within Explore

**Date:** 2026-10-21
**Device acceptance: PENDING.** This slice is source, behavior-helper and free cloud CI validation only.
**No Expo APK** has been approved, built, queued or requested. Previously owner-accepted A1 APK remains the unchanged rollback baseline.

## Product context

The merged A2.7 Save work action and A2.8 Saved work only filter made it possible to find fictional sample work again without leaving Explore. The next limitation: the saved-only filter returned a union of both named collections, with no way to discover just **Inspiration** versus **Outfit ideas** while retaining a skill or search query.

A2.9 introduces a clearly scoped, reversible **All saved · Inspiration · Outfit ideas** filter row *inside the existing saved-only Explore mode*. It continues the content → discovery → saved inspiration flow without implying verified work or real bookings.

## What changed

- Introduces a distinct `exploreSavedCollection: Collection | null` UI state, independent from `selectedCollection` already used by the Saved Feed. `null` means **All saved**, not "unsaved".
- When **Saved work only** is checked, show horizontal named collection choices with truthful per-collection post counts and selected tab semantics. Minimum pressable height 48dp, aligned with existing compact Android navigation guidance.
- Apply the existing **pure** `selectSavedPosts(explore, saves, exploreSavedCollection)` selector after the content-aware `filterDemoExplorePosts` search. Text and skill chips still intersect collection selection. Nothing is duplicated or reordered.
- Off mode continues to show **all** matching fictional posts, irrespective of a previously chosen collection. When switching saved-only back on, the chosen collection remains selected until explicitly changed or Clear search and filters is tapped.
- Scoped empty state identifies a selected collection and suggests **All saved** or clearing the filters. Reset returns query to empty, category to All, saved-only off and collection scope to All saved.
- The **Profile, See work, Save work** actions remain separate. They and the named Save modal continue sharing one in-memory saves object; You-tab collection counts and Feed paging use the previous code.
- No additions to posts, content, rankings, real geolocation, logins, server persistence, payments, merchant products or transactions.

## Cloud test contract

The new Node A2.9 contract executes the *actual* `filterDemoExplorePosts` and `selectSavedPosts` TypeScript helper functions against the *actual four literal fictional Feed fixtures*, with no mocked search or collection behavior. Tests cover empty saves, union and both independent named sets, posts belonging to both collections without duplicates, original Feed order, intersections with text and skill, removal of collection membership, and non-mutation.

Source checks assert separate Explore-vs-Feed collection states, 48dp tabs, selected accessibility state, per-collection result count, conditional display, reset, truthful empty messaging, preserved earlier interactions, no connected APIs and owner-gated Expo preflight. The prior A2.8 check is adapted for a scoped collection argument, leaving its original selector scenarios intact.

Mobile Cloud CI will run all A1/A2.1–A2.9 contracts, Expo TypeScript, SDK native autolinking and Android Metro export. Free Foundation and Android native Gradle jobs remain separate. The manual Expo workflow runs these checks *only if separately dispatched by the owner*; it will not queue a new APK from this PR.

## Real-device QA to perform later — NOT RUN

| Journey | Expected |
|---|---|
| Save a post to Inspiration, another to Outfit ideas, one to both | All saved shows three unique posts; each named collection shows its relevant subset |
| Enable Saved work only and select Inspiration | Only those in Inspiration appear; correct count and selected state |
| Search for "fade" and choose Beauty then Outfit ideas | The matching saved barber appears only if in Outfit ideas |
| Toggle saved-only off with Inspiration selected | Normal Explore content returns, without losing query/skill selections |
| Toggle saved-only on again | Previous named collection remains selected |
| Remove the last Inspiration membership via the existing Save work sheet | Post disappears from Inspiration results but remains in Outfit ideas if still saved there |
| Select a named collection with no matches | Describes the selected collection; switch to All saved or Clear filters |
| Clear all filters | Query blank, skill All, saved-only off, collection scope reset |
| Android 320dp, enlarged fonts, TalkBack and keyboard | Horizontal chips remain reachable, with distinct labels and no clipped pressable actions |
| Offline airplane mode | No API, real location, booking, payment, escrow, live media or externally saved state |

Cloud tests do **not** certify rendered mobile layout, gesture handling, Android Back, Android accessibility or physical device behavior. Future actual QA must record device and build ID, version, width, PASS/FAIL, screenshot or repro, and owner acceptance.

## Review/approval gate

Owner review and manual merge only after three **exact-head** checks are green: Mobile Cloud CI, Foundation CI, and free native Android Gradle. No automated merge. Production database changes, private credentials, new Expo APK, releases and payment activation remain outside scope.
