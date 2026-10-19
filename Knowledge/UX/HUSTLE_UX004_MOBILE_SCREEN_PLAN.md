# Hustle UX004 — Mobile Visual and Experience Upgrade
**Status:** Proposed experience architecture and implementation plan; documentation only
**Date:** 2026-10-19
**Scope:** Expo / React Native Android-first; working offline demo as the regression baseline
**Change policy:** No production data, environment, authentication, backend, payments, escrow, deployments, or paid services. Do not merge visual implementation without owner review.

## 1. Evidence and product intent
This plan uses (1) the owner's real Android screenshot and confirmed 7/7 interaction test, (2) the existing Expo SDK 54 Android offline demo and MobileExperience implementations, (3) the uploaded 123-image Pinterest reference collection and the prior UX004 review, and (4) the project MVP phases and AED Experience Architecture-before-Build principle.

**Hustle is not a generic social feed.** Each content experience should answer: *What can this person do? Where? Can I trust them? What can I request or buy?* Preserve the economic journey:
**Skill → demonstration → discovery → trust → opportunity → booking/transaction → reputation → growth.**

### Verified vs. not verified
- **Verified by owner:** successful install and launch on a physical Android phone after the React resolver fix; swipe feed, switch For You/Nearby, like/comment/reply, save, search/explore/profile, inspect offer/booking previews and switch bottom tabs (7/7).
- **Verified by code inspection:** the offline demo uses four fictitious creators, illustrated rather than filmed posts, local in-memory engagement state, and no working network/checkout/real booking. Its current screens are Home, Explore, Inbox and You with a central Create placeholder; interactions use modal sheets.
- **Not verified:** video playing on device, background/resume, slow/low-memory Android, accessibility scaling, durable state, real user/creator API, real availability, real transactions, production trust or deployment.
- **Screenshot caveat:** reflected light and physical display cracking make the photograph insufficient to judge precise color rendering; spatial hierarchy and visible UI can still be assessed.

### Source-grounded design synthesis
Name this direction **Expressive Tactile Minimalism**: premium, calm, spacious, physical-feeling controls with selective personality and purposeful motion.
- **Soft surfaces / tactile controls:** pins 1, 17, 19, 21, 36, 51.
- **Floating pill navigation / geometric icons:** pins 47, 54, 60, 61, 85.
- **Immersive creator imagery, layered social/feed layouts:** pins 75–78, 90–93.
- **Expressive 3D/motion accents:** pins 7–10, 32, 67–72, 97–103.
- These are reference *principles*, not assets to copy. No wholesale pin recreation; use original Hustle design tokens and content.

## 2. Experience decisions to lock before coding
1. **Recommended hybrid theme, pending owner sign-off:** immersive charcoal/dark Feed and eventual Live; cream/light Explore, detail screens, Inbox, You and forms. Do not apply blur uniformly.
2. **Home is skill discovery, not empty entertainment:** creator profession, general Lagos location and attached offer remain accessible during viewing.
3. **One account, progressive capabilities:** every identity is a Client; Hustler capability is additional after approval. Never add a role-switcher.
4. **Work-first profile:** demonstrate skills/portfolio and services/products before follower counts. Verification and review metrics appear only when data genuinely exists.
5. **One-thumb conversion:** Post → Creator or attached Offer → Consultation/Booking preview, retaining back navigation to the original post.
6. **Offline demo integrity:** visible “Demo / fictional content” context, no fake real-time location/Live/availability, no actual requests/payments, no real account connectivity.
7. **No new paid imagery, animations, backend, storage, analytics, fonts, media hosting or staging.** Prefer built-in React Native / installed Expo packages, self-authored illustrations and licensed small demonstration media where explicitly approved.

## 3. Visual foundation / proposed tokens
Maintain current usable palette while upgrading hierarchy; actual contrast remains a QA gate:
- Ink #151D19; dark charcoal #26332A; paper #F7F6F2; white #FFFFFF; accent lime #C9F26B; supporting muted #758178.
- Accent lime is an **action/status highlight**, not body text on pale backgrounds; contrast-check every pairing. Feed text uses high-contrast white plus controlled dark gradient/scrim.
- Spacing rhythm 4/8/12/16/24/32; core card radius 16–24; navigation, toggles and category chips have pill radius.
- Body text recommended 14–16 sp or larger; prominent captions 14–16; metadata minimum 12 unless optional decorative label; headline scale adjusts to text expansion. Avoid 9 px labels as the sole source of critical information.
- Icon shapes: one consistent line-icon family from currently installed @expo/vector-icons; active states use fill, stroke/contrast and text semantics, not hue alone.
- Touch targets minimum 44–48 dp; safe-area-aware overlay spacing and keyboard avoidance; no content obscured by floating nav or Android gesture/navigation area.
- Motion: short scale/opacity/translation transitions, optional gentle spring and haptic-like visual feedback. Honor reduced motion; avoid mandatory glass, expensive blur and constant ambient 3D effects.
- Navigation surface is dark/frosted over video, solid/light on utility screens; same hitboxes and semantics.
- Use original illustrations only as fallback/loading/empty states. Work evidence should ultimately be actual media, not a giant emoji pretending to be a video.

## 4. Screen-by-screen specifications

### UX004-01 — Home / immersive For You feed — P0
**Baseline:** Existing full-height FlatList, LIVE/For You/Nearby tabs, poster artwork, right rail, creator/caption area, offer pill, bottom navigation.

**Composition:** edge-to-edge vertical video or media with safe gradient; compact brand and search top bar; centered feed tabs; unobtrusive demo indicator; right creator/like/comments/save/share rail; bottom-left identity + verified skill/location when truthful; **one prominent attached offer card** above nav; persistent nav separate from content.
**Interactions:** vertical snap/paging, double-tap like, single-tap pause/play for video, mute control, creator opens full Hustler profile, attached offer opens detail, long caption expands, comment and save sheets, share native sheet. Back preserves feed index.
**Feed variants:** For You uses curated synthetic interests; Nearby in demo uses explicitly labelled sample locations (not device GPS or distance). LIVE is clearly a disabled preview, never a fake live broadcast.
**States:** poster/static fallback, buffering, no-media, muted/offline, empty saved feed, inactive tab, re-open after background.
**Acceptance:** 7/7 existing behavior unchanged; rail and offer stay above navigation; screen reader identifies controls; no overlap at Android minimum heights; active media stops when offscreen; zero real network calls in demo.

### UX004-02 — Feed comments / replies sheet — P0
**Composition:** draggable light sheet, title/count, compact threaded comments, reply context, pinned composer above keyboard.
**Interactions:** open/close swipe or close button, view replies, start/cancel reply, submit valid comment, keyboard return; tap outside and Android Back dismiss safely.
**States:** empty, nested replies, long text, keyboard open, sending simulated/local. Reply always associates with correct parent/post.
**Acceptance:** no lost original feed position; no keyboard overlay, no invisible Send, no pretending comments are server-persisted.

### UX004-03 — Save collections and share — P0
**Composition:** clean bottom sheet with collection rows, check states and optional “Saved” confirmation; share via existing Android native share action.
**Interactions:** toggle Inspiration / Outfit ideas, view saved feed from You, return to same source post, cancel sheet.
**States:** saved, unsaved, no collections, native sharing unavailable.
**Acceptance:** existing local save semantics preserved and openly labelled as session-only; no external post link invented for a fictional creator.

### UX004-04 — Explore landing / discovery — P0
**Baseline:** current Explore search field, category chips, fictional creator list, disclosure.
**Composition:** cream background, title, persistent search, category rails (All/Fashion/Beauty/Food/Media), mixed modular cards: featured work first, recommended creators, services and products. Use intentional asymmetry inspired by Pinterest, but avoid masonry that damages reading order or performance.
**Interactions:** tap search, filter category, open post/profile/offer, clear filters, preserve search query when returning.
**States:** empty filtered results, not-found suggestions, initial recommendations, demo-location transparency.
**Acceptance:** categories are functional; creator/offer type is unambiguous; no inferred device proximity presented as a fact.

### UX004-05 — Search results + filter controls — P1
**Composition:** distinct results tabs Top / People / Posts / Services / Products, persistent query, visible result count, compact price/location/skill filters.
**Interactions:** local text matching on synthetic data for this release; switch tab without clearing query; reset filters; result opens the proper full page.
**States:** empty, query cleared, unrecognized location, filters yielding zero matches.
**Acceptance:** filters only display fields actually present; results are distinguishable by entity type; no unbacked availability, verification or ratings.

### UX004-06 — Hustler profile / public professional identity — P0
**Composition:** cover/hero work media, avatar, display name/handle, specialty, city/working area, short bio, portfolio proof, primary action row (Follow / Message / Share / Book where appropriate), tabs Work / Posts / Services / Products / Reviews. Work and bookability lead; follower counts are secondary.
**Interactions:** enter from feed/profile/Explore; swipe or tap profile tabs; open work/offer; follow toggle local in demo; share preview and explicit disabled message CTA in offline mode.
**States:** verified/unverified, no portfolio, service-only/product-only, no reviews yet; only show verification or numeric rating with authentic future source data.
**Acceptance:** a stranger can understand who, skill, location and next action without scrolling excessively; accurate relationship between one account, Hustler approval and public content.

### UX004-07 — Portfolio / work detail — P1
**Composition:** work grid mixing video and images, project captions, category tags and optional “associated service/product” attribution, clean full-screen viewer.
**Interactions:** open selected work from profile; swipe media sequence; return to same grid scroll position; visit referenced offer.
**States:** image, video, empty work, unavailable media, multi-reference.
**Acceptance:** media is labeled by type and does not auto-play multiple simultaneous videos; no fake completed-job claims.

### UX004-08 — Hustler services catalog — P0
**Composition:** profile-linked service list with image, title, base price/pricing type, duration/delivery estimate and service area; card links to detail. An empty-state CTA for future approved Hustlers can be shown as disabled in demo.
**Interactions:** filter services by type, open service, return to profile without losing tab.
**States:** no services, price on request, paused service (non-bookable), unavailable duration.
**Acceptance:** service and product listings cannot be confused; no fake booking availability.

### UX004-09 — Service detail / consultation and booking CTA — P0
**Composition:** hero media, title/category, provider identity/link, price with qualifier, “what is included,” modality/area, duration where known, requirements, notes and clear sticky CTA (Consult / Request booking).
**Interactions:** open from feed attachment or profile; provider tap returns profile; preview booking; ask a question goes to non-sending demo explainer.
**States:** fixed price / starting from / quote required, availability unknown, remote/physical, sample-only.
**Acceptance:** no charge, no confirmed reservation, no implication that sample price equals final price. CTA says “Preview booking” in offline demo.

### UX004-10 — Product catalog and product detail — P0
**Composition:** separate catalog cards; product detail with photo gallery, description, price, optional variants/availability, creator/seller, fulfillment note and visible (disabled) cart/checkout affordance.
**Interactions:** gallery swipes; choose demonstrative variant; visit creator; product-linked post.
**States:** unknown stock, out-of-stock example explicitly demo, missing fulfillment data, no variant.
**Acceptance:** distinguish purchase from booking; no real cart mutation, money movement, inventory decrement or fake order confirmation.

### UX004-11 — Consultation / booking preview — P0
**Baseline:** current modal with sample time slots and “Preview request (not sent).”
**Composition:** multi-step preview (service → sample date/time → requirements/notes → review). Provider + service summary remains visible, with explicit “No real availability checked” notice.
**Interactions:** select sample time, enter requirements, go back/forward, cancel safely; finishing produces an unmistakably **simulation-only** confirmation.
**States:** no selected slot, long requirements, invalid input, dismissed flow, reopened flow.
**Acceptance:** never represents an appointment as actually booked; no payment gateway, production access, server transaction or live slot fetch.

### UX004-12 — You / account and saved collections — P1
**Composition:** lightweight identity header, profile image/handle for demo guest, collections, saved posts, shortcuts for future capability management. Preserve “one identity” messaging, not a Client/Hustler role switch.
**Interactions:** open collections, return to saved feed, view sample profile or account capabilities as non-active previews.
**States:** guest, no saved items, connected account later (out of scope).
**Acceptance:** clearly states offline/temporary data; no settings that falsely imply server persistence.

### UX004-13 — Inbox, Create and empty-shell navigation — P1
**Inbox:** present intentional empty message state and possible future consultation-linked conversation layout; do **not** fake sending or imply a connected inbox.
**Create:** central + remains visually discoverable. It may open a *clearly labelled non-publishing composer preview* with local sample media and mock attachment selector; actual upload/publishing belongs to a separately gated backend-connected phase.
**Global nav:** five destinations Home / Explore / Create / Inbox / You. Create is an action, not an active tab; active state otherwise tracks destination. Bottom bar stays within safe areas, preserves tab state, and does not cover cards/sheets.
**Acceptance:** Android Back: sheet → prior detail → prior tab → Home / exit; consistent active states; no dead buttons disguised as working commerce actions.

## 5. Primary journey and navigation contract
**Main discovery loop:** Open app → For You/Nearby → view skill proof → tap profile or offer → inspect service/product → consultation/booking **preview only** → return to original post. 
**Intentional discovery:** Explore → search/category → results by type → Hustler profile → Work / Services / Products → detail.
**Saving:** Feed → Save collection → You → collection → saved feed → same creator or offer.

Navigation should separate tab routes, in-tab detail stacks and bottom-sheet overlays. Closing a sheet preserves content and tab position. Root Home state is restored sensibly after back navigation; Android physical Back works. Share links and storefront website can be **designed** now but must not be advertised as implemented until connected.

## 6. Reusable component architecture (future implementation, NOT part of this documentation PR)
Keep current working entry / App + demo flag. Split the 31K-character single-file DemoExperience incrementally behind the same demo flag rather than replacing everything in one PR:
- src/ux004/theme: tokens, typography, safe-area/contrast helpers
- src/ux004/components: TactilePill, FloatingTabBar, IconAction, CreatorIdentity, OfferAttachment, WorkMedia, EmptyState, DemoDisclosure, SheetHeader
- src/ux004/feed: ForYouScreen, FeedPost, CommentsSheet, SaveSheet
- src/ux004/discover: ExploreScreen, SearchResults, FilterSheet
- src/ux004/profile: HustlerProfile, WorkGallery, UserProfile
- src/ux004/commerce: ServiceList/Detail, ProductList/Detail, BookingPreview
- src/ux004/navigation: demo tab state + detail stack/sheet contract
- src/ux004/data: fixture models / selectors / deterministic fictional content

The above paths are **proposals**; do not assume files exist. Use existing Expo SDK 54, expo-video, @expo/vector-icons and react-native-safe-area-context versions already in lockfile. The Metro single-React resolver that fixed the real-device crash must remain intact.

## 7. Interaction rules and behavioral contracts
- Hero video: at most one active player; autoplay muted by default if preview media is approved; show pause/mute/error controls; pause on swipe, background or modal overlay. Poster is valid fallback.
- All media sample metadata has provenance or license approval. No paid stock/photo platforms. Images/video used for offline QA must be safely distributable with the APK.
- Double-tap like must not accidentally trigger full-screen player toggles; accessibility users get explicit Like action.
- Comments and save are local-only, in-memory unless later separately approved. No false persistence.
- Buttons are functional, disabled with explanation, or omitted. No silent no-op “Message,” “Book,” “Buy,” “Live” or “Publish.”
- Use visual feedback for follow, like, save, tabs and selected booking preview slot. Do not represent placeholder success as a real transaction.
- Add error/empty/loading/offline state for each major screen; on Android Back and app resume, no crash or hidden overlay.

## 8. Build sequence and review gates
**A0 — Experience architecture sign-off (this document only).** Lock hybrid theme, content hierarchy, entry-point map and primary CTA copy. No code.
**A1 — Design tokens + nav shell.** Add reusable theme/components behind demo flag; preserve Home/Explore/Inbox/You/Create semantics; Android safe areas/back; snapshot evidence. Gate: 7/7 old test still works.
**A2 — Feed + sheets.** Improve full-screen media layout, offer CTA, legibility, engagement overlay, comments/save/share. One controllable authorized demo video if asset rights + APK size are acceptable; otherwise retain safe posters. Gate: no crashes, one media player, old feed interactions.
**A3 — Explore + search + profile.** Local fixture indexing, category and entity tabs, Hustler full profile and work portfolio. Gate: feed→profile→offer and search→profile paths work and return context preserved.
**A4 — Services, products + booking preview.** Clear types, media/price/requirements, simulation-only checkout/availability guards. Gate: no network/payment/write; false-real-world states impossible.
**A5 — Polish, empty states, accessibility + regression QA.** Keyboard/back/safe-area states, high contrast, reduced motion, screen-reader labels, orientation/text scaling, low-memory media fallback. Gate: all tests pass.
**A6 — Cloud packaging and controlled phone review.** GitHub read-only Mobile/TypeScript, Metro export, native Gradle checks on each implementation PR. Preserve previous successful Android demo APK as rollback reference. Queue **one** new Expo Free demo EAS build only after explicit owner consent, merge and checks; EAS GitHub “queued” success is not APK success; inspect Expo actual result. Owner retests on phone before release.

Each implementation slice is reviewed in its own PR; no mass rewrite, production credentials, new database, Supabase mutation, real payment, staging service, paid license or automatic Expo quota consumption. PR checks are free GitHub cloud workflows.

## 9. Verification / acceptance matrix
- **Functional:** previous 7/7 owner tests remain passing; add deep-route return, repeated like/save, comment threading, search reset, empty states, booking preview disclaimers.
- **Device:** real Android device launch stable for 10 minutes; background/resume; airplane-mode open; tap/keyboard/back; low-height/small-width devices and system font scaling. Must test on hardware, not infer from bundle/Gradle success.
- **Visual:** profile and offer legible at a glance; minimum tap size 44–48 dp; good contrast; no obscured CTA under floating bar or Android gesture strip; no excessive blur/animation.
- **Performance:** smooth vertical scroll without multiple active videos; no crash under repeated navigation; avoid large 3D assets and full-size media memory spikes; measure before setting numeric performance targets.
- **Integrity/security:** demo remains offline with fictional data, disabled real Live/booking/checkout/publishing, no backend traffic and no sensitive environment keys; no fake verified badges or ratings.
- **CI and manual owner gate:** JS/TS, Metro resolver singleton contract, native autolinking, Android Gradle checks green before owner-approved single APK build; actual Expo APK status Finished; phone smoke verified.

## 10. Definition of “UX004 complete”
UX004 is done when all scoped screens use one visual language; full Feed → Hustler profile → offer → booking **preview** path is clear and testable; Explore and saved collections work; all interactions have accurate semantics; accessibility, low-memory and physical Android smoke checks pass; and the owner approves the updated experience. This is **not** equivalent to the connected Hustle marketplace being activated.

## 11. Pending design/product decisions for owner
1. Confirm **hybrid light utility + dark immersive Feed/Live** (recommended) versus a predominantly dark product.
2. Confirm primary Feed CTA label **View service/product** with separate **Book/Consult** on the detail page (recommended), or immediate booking CTA on the feed.
3. Choose whether Create opens only a clear placeholder for UX004 (safest) or a non-publishing composer prototype.
4. Approve one or two small legally usable video samples for the APK, or keep static samples until authenticated real publishing.
5. Decide which Hustler trust attributes have truthful data in the future connected build; hide unsupported rating/verification during UX004 demo.

## 12. Next action
Owner reviews this **documentation-only** plan and resolves pending design decisions. Start A1 on a separate reviewed code PR only after that. Preserve the currently working physical Android APK and the offline demo controls as non-regression references.
