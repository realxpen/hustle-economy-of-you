# Hustle UX004-A2.8 — Saved-only discovery within Explore

**Date:** 2026-10-21
**Device acceptance: PENDING.** This is a cloud/source-tested slice; no owner phone/Waydroid/TalkBack test was performed. **No Expo APK** was requested, approved, or queued. Previously accepted A1 APK remains the untouched fallback baseline.

## Product need and scope

A2.7 let people save fictional demonstrated work from Explore. However, to rediscover that work they needed to enter their You profile and open a named collection. A2.8 adds a simple **Saved work only** filter to Explore itself, making content discovery and collection management feel connected without claiming any live services.

- The saved-only control is a clear 48dp checkbox in Explore, with a current local saved-post count and accessibility labels. Off by default.
- When selected, it **intersects** the existing keyword query and category chip using the exact same in-memory saves record as Feed, Explore Save and the You collections.
- The results count and cards reflect the filtered set, not the full query result set. There is no invented ranking or geolocation.
- When nothing is saved, a friendly empty state explains that a post can be saved from Explore. Its reset action clears search, category and saved-only together.
- A post saved into either named collection appears once in saved-only results. Removing it from one collection while the other still contains it keeps it visible; removing its last collection immediately hides it.
- Searching and filters persist while switching tabs. The existing **See work**, **Profile** and **Save work** actions, current post/index handoff, Like/comments, and illustrative offer details are unchanged.
- Save state is session-local, fictional and not persisted to a backend. No login, analytics, real recommendations, media, API, production payment, escrow or booking.

## Implementation and executable acceptance

This slice reuses the already tested pure `filterDemoExplorePosts` and `selectSavedPosts` selectors instead of creating a second save store. The offline Android demo continues to share the same single saves object across Explore and Feed.

The A2.8 Node contract transpiles and runs both real selectors against the **actual four literal fictional fixture posts** from `DemoExperience.tsx`. It checks no-save empty mode, category/search intersections, multi-collection union, removal of last save, original Feed order, and no fixture mutation. Static screen checks assert accessible checkbox semantics, truthful live result count, reversible reset, 48dp target, screen continuity, demo-only disclosures, and owner-gated manual build.

A2.5, A2.6 and A2.7 test guards are updated to recognize `visibleExplore` rather than stale, pre-filter result rendering; each original functional contract still runs. All existing UX004-A1 through A2.8 tests run in Mobile Cloud CI and preflight of the manually approved Expo demo workflow.

## Deferred hardware QA (NOT RUN)

| Journey | Expected |
|---|---|
| Open Explore without saves, enable Saved work only | Truthful zero results, guidance, reset action |
| Save a fashion post to Inspiration then return to Explore Saved only | One matching fashion post, accurate 1 saved |
| Save the same post to both named collections | One result, not duplicate |
| Save barber to Outfit ideas, search "fade" and choose Beauty | Only matching saved barber |
| Search "portrait" with saved filter still active | Zero results unless photographer was saved |
| Clear search field alone | Category and saved filter preserved |
| Clear search and filters | Query empty, All selected, saved-only disabled, four sample posts visible |
| Remove last collection from a saved post | It disappears from saved-only results after modal closes |
| Tab away and return | Filter, query and category preserved within current demo session |
| Compact Android width, keyboard, enlarged font, TalkBack | Checkbox and all card actions reachable; no clipping, overlap or focus traps |
| Airplane mode | No network requests, verified-provider claims, transaction, booking or media loading |

A physical Android test result requires the exact build/OS/device/width, reproduction, screenshot when available, PASS/FAIL and owner acceptance. Green source/Metro/native CI is **not** physical-device acceptance.

## Approval boundaries

Review only once Mobile Cloud CI, Foundation CI and free native Android Gradle pass on the exact PR head. Owner retains manual merge authority; no Expo build, production release, DB/ledger activation or new dependencies are part of this slice.
