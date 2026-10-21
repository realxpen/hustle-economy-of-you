# Hustle UX004-A2.1 — Feed gestures, captions and accessible action rail

**Scope:** First Feed/social-interaction implementation slice after **UX004-A1 accepted on 2026-10-21**. Mobile offline fictional demo only.

**Device acceptance: PENDING.** Owner currently cannot access Waydroid/emulator or Android; this PR is designed for cloud CI and a later controlled review. Existing successful A1 APK `189f1447-93f9-4d63-b331-f38a7125a9f9` is a rollback baseline, **not** an A2 test.

## Product behavior delivered by A2.1

1. **Double-tap to like sample artwork:** two taps of the *same* artwork within a 300ms window add a like; a single tap does nothing since the current offline Feed has **illustrations, not video**. A double-tap on an already-liked artwork must not unlike it. Taps on different posts or separated by >300ms do not count as a pair. The existing rail Heart independently toggles like/unlike, for both touch and accessibility users.
2. **Expandable caption per post:** captions start at two lines; tapping their own 48dp-minimum area reveals the full caption and “Show less” restores two lines. Expanding one post does not expand other posts. Caption tap must not accidentally open the Creator or attached offer.
3. **Meaningful screen-reader actions:** the rail may show counts/compact labels visually but reads “Like/Unlike {creator} work,” “Read comments on {creator} work,” “Manage collections for {creator} work,” and “Share fictional work from {creator}.” The large invisible artwork tap region is not a screen-reader stop; accessible Like remains the rail button.
4. **No hidden commerce activation:** Feed → Creator → service/product offer, comments, saves, native demo share, preview booking, and disabled Create/Live remain as accepted in A1.

## Architecture and tradeoffs

- Implemented inside `apps/mobile/src/experience/DemoExperience.tsx` for this small slice, before the larger component extraction envisioned in the approved [UX004 mobile plan](../UX/HUSTLE_UX004_MOBILE_SCREEN_PLAN.md).
- Local React state and a timestamp ref hold likes and caption expansion; no background timers, new packages, gesture-handler plugins, media permissions, SDK changes, backend, network, Supabase sessions, video, analytics or real publishing.
- Keep the existing A1 **measured FlatList viewport**, safe-area offsets, bottom capsule, Android Back/keyboard hook and Metro forced-single-React resolver. Add no permanent data persistence.
- On artwork double-tap the only visible feedback is the existing filled lime heart and incremented count. Animation/vibration would need separate QA and is deliberately deferred.
- Long expanded text can increase the vertical overlay height. Cloud checks can't prove short-device overlap, font scale or gesture arbitration; log those during later Waydroid/Android QA.

## Cloud acceptance (automated checks; do not imply phone pass)

- [ ] Mobile Cloud CI: `ux004-a21-feed-contract.cjs`, existing A1.1–A1.4 guards, offline safety, singleton React resolver, Expo SDK native module checks, TypeScript and Metro Android bundle all green.
- [ ] Foundation CI green.
- [ ] Free Android native Gradle diagnostic green.
- [ ] Owner reviews the PR and merges manually.
- [ ] **No new Expo APK** is queued or approved in this slice.

## Deferred device acceptance — when emulator/phone access returns

Use an **explicitly approved newer** APK only after merge + all CI green (one EAS Free build must be requested separately). Then record each result PASS/FAIL/PENDING:

| ID | Scenario | Expected |
|---|---|---|
| A21-01 | Single tap poster | No like or false video play |
| A21-02 | Double-tap one poster quickly | Heart fills and count increases by one |
| A21-03 | Double-tap same liked poster again | Remains liked; **does not unlike** |
| A21-04 | Tap rail Heart on liked poster | Unlikes; next tap relikes |
| A21-05 | Two taps on different posts or separated >300ms | No combined like |
| A21-06 | Expand/collapse caption, switch Feed posts/tabs | Correct caption per post; no creator modal from caption tap |
| A21-07 | Saved collections and comments/Back with keyboard | Preserve A1 behaviors; no accidental gestures on overlay |
| A21-08 | Browse narrow screen/large text with expanded caption | Rail, attached offer and floating nav remain reachable; no obscured safety notice |
| A21-09 | TalkBack/screen reader rail navigation | Like/Unlike, comments, save and share have descriptive labels; no invisible artwork control in focus |
| A21-10 | Airplane mode, Create, Live, service/product preview | Fictional and offline; no real publish, booking or payment |
| A21-11 | Use for >=10 minutes, background/resume | No crash, state/Feed location behave as designed |

**Current device results for A2.1:** PENDING (no device access). Do not carry A1 7/7 forward as proof of this new feature.

## Next A2 slices (not authorized by this PR)

A2.2 — comments/reply sheet usability and collection feedback; A2.3 — offer attachment hierarchy and media fallbacks; A2.4 — later phone visual/interaction acceptance. Real video needs a separately approved, distributable licensed asset and perhaps a later explicitly approved Expo build. No fake Live/video behavior.
