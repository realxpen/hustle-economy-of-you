# Hustle UX004-A2.2 — Comments, Replies and Collections

**Scope:** Small follow-up to merged UX004-A2.1; fictional offline Android demo only. No backend, production account, publishing, payments, real bookings, Live or video playback.

**Device acceptance: PENDING.** Owner currently cannot access Waydroid or an Android emulator/phone. This is a cloud-only code review slice; **No Expo build** is authorized or queued. The owner-accepted A1 APK remains the rollback reference, not evidence that A2.2 works on hardware.

## Functional behavior

### Comments
- Show explicit per-post sample comment count and a statement that comments last only for the current app session.
- Order each root comment followed by its direct replies without hiding orphaned or legacy multi-level records.
- Selecting Reply on an existing reply targets the **original root comment** so the demo UI remains single-level rather than nesting indefinitely.
- A visible "Replying to @..." context identifies the target root. **Cancel** clears the reply association without erasing the typed draft.
- Keyboard Send and the 48dp Send target still add a **local-only** comment; empty input does nothing. A 500-character field limit protects layout against unbounded drafts.
- Accessibility: Reply controls, cancellation and composer are labeled. Modal/scrim/Android Back and keyboard-first closing behavior remain unchanged.

### Collections
- Tapping **Inspiration** in You displays only posts saved to Inspiration; tapping **Outfit ideas** shows only posts saved there.
- Empty named collections display a named empty-state message. "Return to For You" restores the previously browsed ordinary Feed post.
- Leaving a saved collection through root navigation clears its temporary collection filter and restores the original Feed index.
- Save sheet checkboxes state **Saved ✓** vs **Add**, expose checkbox accessibility state, and show a local-only save summary.
- Existing two fixed collection names and session-only save model remain; no server account, cross-device persistence, new collection creation, real share link, or media upload is implied.

## Test architecture (cloud)

- `apps/mobile/src/ux004/feed/demoSocial.ts` has pure, exported `orderDemoComments`, `replyRootId`, and `selectSavedPosts`. It is independent of React Native and all network/backend modules.
- `apps/mobile/scripts/ux004-a22-social-contract.cjs` transpiles that pure TypeScript helper using the existing workspace `typescript` dependency, tests actual behavior with fixtures (including nested/orphan replies, wrong-collection exclusion and order), and checks demo UI bindings and safety.
- The Mobile Cloud and owner-approved *manual* EAS preflight run the contract alongside existing A1 and A2.1 checks.
- Prior A1.2 and A2.1 static acceptance scripts now match the `openSavedCollection(collection)` signature, preserving their safety and navigation assertions rather than removing them.
- The existing React singleton resolver, Expo pins, offline data, navigation, Android Back/IME and payment safeguards are untouched.

## Cloud acceptance

- [ ] A2.2 pure helper tests + source contract PASS.
- [ ] A1.1, A1.2, A1.3, A1.4 and A2.1 regression scripts PASS.
- [ ] Mobile TypeScript and Metro Android bundle PASS.
- [ ] Foundation CI PASS.
- [ ] Free native Android Gradle diagnostic PASS.
- [ ] Owner reviews and merges the PR manually. No automatic merge.
- [ ] **A2.2 real-device result remains PENDING**, irrespective of CI success.

## Device QA backlog (when Waydroid or phone is accessible)

| Test | Expected |
|---|---|
| Comment thread | New root comment followed by its replies; older sample data still legible |
| Reply to existing reply | Composer shows original root handle; next reply associates with root |
| Cancel reply | Preserves unsent text; subsequent send creates a root comment, not a reply |
| Empty and long comments | Input rejects empty drafts, supports up to 500 chars, sheet scrolls |
| Keyboard + Back | First Back hides keyboard, second closes sheet; no accidental submission |
| Save sheet | Each checkbox immediately reflects selected state; local summary updates |
| Named collection A/B | Each shows only its own posts; posts in both appear in both; empty collection is named |
| Return to For You | Correct original post index after browsing collection and switching tabs |
| Accessibility | TalkBack checkbox checked states and Reply/Cancel/Send readable |
| Screen/phone regression | Small display, large text, 10-min stability, offline safety and tab/feed interactions |

**Status at authoring:** no A2.2 device testing performed. No screenshots, device metrics, live media or Expo builds requested. These must be reviewed separately before a device release.

## Next slice

UX004-A2.3 — Feed overlay/offers and fallback media presentation, still without unapproved video, real transactions, database or native packages.
