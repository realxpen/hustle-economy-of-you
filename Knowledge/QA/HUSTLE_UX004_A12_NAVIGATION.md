# UX004-A1.2 — Floating Navigation and Local State QA

**Status:** implementation review; not yet accepted on physical Android.
**Approved specification:** [UX004-A1 Navigation](../UX/HUSTLE_UX004_A1_DESIGN_SYSTEM_NAVIGATION_SPEC.md) and locked Hybrid theme decision UX004-ADR-001.

## Implemented in this slice
- `apps/mobile/src/ux004/components/FloatingTabBar.tsx`: reusable charcoal capsule, lime selected tab, accurate accessible button/tab roles, existing Ionicons only, safe-area inset, 62dp bar, >=48dp targets and compact horizontal margins.
- `src/ux004/navigation/types.ts` + `useDemoNavigation.ts`: typed four root tabs and separate Create action. No new navigation dependency, backend or persistent state.
- Offline `DemoExperience` uses the new tab bar. Create explains publishing is disabled, remains **unselected** and never sends data.
- Tab switching preserves For You/Nearby mode, local likes/follows/saves/comments, Explore search and category, and regular feed index when the FlatList is remounted.
- You → saved collections → saved feed remains available. Normal feed scroll index is remembered separately from saved-feed browsing.
- Centralized nav bottom reserve for Feed offer and Explore scroll content rather than hardcoding the previous 77dp feed inset.
- New no-cost static guard in Mobile Cloud CI and manual EAS preflight ensures nav semantics and preserves the Expo SDK54/React resolver safeguards.

## Deliberately deferred
- Android BackHandler lifecycle, keyboard hide prioritization and modal focus/IME polish → A1.3; existing `Modal.onRequestClose` preserved. No new BackHandler in A1.2.
- Full Feed overlay re-layout and video playback → A2.
- Authenticated MobileExperience navigation, connected APIs, account actions → out of scope and unchanged.
- APK or any production activity → requires later explicit owner sign-off.

## Cloud and physical QA gates
- [ ] Latest SHA Mobile Cloud CI green: A1.1/A1.2 contracts, Expo SDK54 metadata, React-singleton, TypeScript, Metro offline bundle.
- [ ] Latest SHA Foundation CI green on pinned Ubuntu 24.04.
- [ ] Latest SHA free native Android Gradle diagnostic green.
- [ ] Owner reviews and merges only after green checks.
- [ ] Separate owner-approved APK + physical Android test for final A1.2 acceptance.

### Manual smoke matrix after a future explicitly approved APK
1. Scroll to third Feed post → Explore → Home: remain on third post, no accidental reset.
2. Explore → select Beauty and search → Inbox → Explore: same query and category.
3. Open comments sheet → dismiss with Android Back: same original post and local replies intact.
4. From any tab, tap Create: explanatory offline alert and **same selected tab**, no permissions or publishing.
5. Like/save/follow post → change tabs → return: visible local state remains.
6. You → save collection → saved Feed → Explore → Home: regular Feed index restored.
7. Test at narrow width, gesture navigation and Android 3-button mode: five targets remain accessible and capsule above system bar.
8. Verify offer pill above capsule and no clipped Explore scroll content, including system font enlargement.
9. Navigate repeatedly for >=10 minutes; avoid native/JS crash and preserve signposts “Demo/Fictional”; keep network off.

## Rollback
The previously successful real-device APK and Expo project remain unchanged. Restore the A1.1 main state if any navigation regression occurs. No EAS credit consumed by this PR.
