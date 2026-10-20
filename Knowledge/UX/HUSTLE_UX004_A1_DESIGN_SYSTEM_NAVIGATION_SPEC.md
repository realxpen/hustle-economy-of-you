# Hustle UX004-A1 — Design System and Navigation Implementation Specification

**Status:** Detailed implementation specification / proposed work package. No code changes in this document.
**Date:** 2026-10-20
**Decision authority:** Owner-approved UX004-ADR-001 in [UX004 mobile screen plan](./HUSTLE_UX004_MOBILE_SCREEN_PLAN.md).
**Locked theme:** **Hybrid — dark immersive Feed and future Live; cream/light utility and detail screens.**
**Target:** Expo SDK 54, React Native 0.81, React 19.1 in the mobile workspace; Android-first, offline fictitious demo.
**Implementation gate:** Owner reviews this specification before a separate A1 code PR. A1 must not trigger Expo or production deployment.

## 0. Why A1 exists / current verified baseline

On a physical Android device the owner verified a crash-free APK launch after PR #142 and completed seven interaction scenarios: Feed swipe, For You/Nearby, engagement/replies, collections, Explore/profile, attached offer/booking preview, and Home/Explore/Inbox/You navigation. Preserve this achievement as the A1 non-regression contract.

Current real files inspected:
- apps/mobile/App.tsx — selects offline DemoExperience before authenticated MobileExperience.
- apps/mobile/src/experience/DemoExperience.tsx — existing 433-line single-file demo containing colors, four tab views, central Create alert, feed, bottom sheets and demo fixtures. Root tabs are Home, Explore, Inbox, You; Create is an action, not a route. Current bottom nav height 59 dp, horizontal gutters 17 dp and icons ~23 dp.
- apps/mobile/src/experience/MobileExperience.tsx — separate connected/authenticated experience using different color constants, not authorized to change in A1.
- apps/mobile/metro.config.js — forces imports to the mobile React 19.1 instance. **Never replace or remove this resolver.**
- .github/workflows/mobile-cloud-validation.yml — read-only cloud CI; TS/Metro/React-singleton/native metadata checks.
- .github/workflows/hustle-offline-android-demo.yml — owner-approved, manual Expo Free Android build only.

The demo currently has hard-coded absolute feed overlays and footer offsets, local-only interactions, synthetic creators, no real API, no checkout and no genuine bookings. A1 is a **system and navigation shell** milestone, not a feature-connectivity release or a demand to replace all illustrated feed content.

### A1 outcomes
1. One typed, reusable, testable Hybrid design-token layer.
2. One shared floating navigation component and clear root-tab / Create action semantics.
3. One safe-area and surface model applying dark Feed vs light Explore, Inbox and You.
4. Consistent pressable, icon, header, demo disclosure and empty-state primitives ready for A2–A5.
5. Reliable tab history, overlay ownership and Android physical Back behavior without new routing libraries.
6. The existing seven owner-validated interactions remain usable; future features stay explicitly disabled.

### Explicit non-goals
No redesign of the full Feed content/card composition (A2), Explore filtering or full profile (A3), real service/product/booking flows (A4), or finished accessibility/performance overhaul (A5). No backend/API/auth/DB/storage/payment/escrow integration. No new dependencies, paid design systems, stock art, fonts, staging, EAS builds, app store submission or production switch.

## 1. Theme contract — LOCKED

### Surface-to-screen mapping

| Context / screen | Surface mode | Background roles | Text / icons |
|---|---|---|---|
| Home — For You / Nearby | dark immersive | media/poster + controlled ink scrim | onDark primary; high-contrast overlays |
| Future Live | dark immersive **design intent only** | dark empty/disabled state | say Live is unavailable; no simulated broadcasting |
| Explore + Search | light utility | paper page, white cards | ink/secondary onLight |
| Hustler profile + work portfolio | light utility by default | paper/white cards with dark hero media where present | text switches role based on the specific media layer |
| Service / product details | light utility | paper page, white cards | ink/secondary onLight |
| Booking preview + comment/save sheets | light sheet | paper sheet over scrim | ink/secondary onLight |
| Inbox / You / collections | light utility | paper/white | ink/secondary onLight |
| Floating global navigation | dark capsule in all root tabs | opaque ink (or simple translucent ink if readability proven) | white inactive icon; ink on lime selected |

**Rule:** no global theme toggle and no alternate fully dark/light product variant in A1. This owner approval sets the default for UX004. Do not relabel a light utility screen as dark because it happens to contain a dark photo.

### Palette: semantic tokens (proposed exact values for A1)
Existing Hustle palette is the anchor; roles, not raw hex constants, must drive UI code.

| Token | Hex / value | Usage |
|---|---|---|
| color.ink | #151D19 | nav capsule, primary type on cream, text on lime |
| color.charcoal | #26332A | dark neutral poster fallbacks |
| color.paper | #F7F6F2 | utility background and bottom-sheet surface |
| color.surface | #FFFFFF | light card surface |
| color.lime | #C9F26B | selected nav item, enabled action emphasis |
| color.textPrimaryLight | #151D19 | primary on paper |
| color.textSecondaryLight | #536159 | functional small text on paper (new accessible token) |
| color.textPrimaryDark | #FFFFFF | primary text on ink/dark scrim |
| color.textSecondaryDark | #A7C2AC | metadata on charcoal dark |
| color.mutedDecorative | #758178 | secondary decorative elements only; **not** default small text on paper |
| color.line | #D9E2D8 | gentle utility dividers |
| color.scrim | rgba(3,8,5,0.63) | modal-backdrop baseline (existing) |
| color.overlayDark | rgba(4,8,6,0.50) | fallback text-support overlay on video/poster; calibrate per actual media |
| color.danger | system semantic | error states only; do not convey error with color alone |

**Calculated contrast examples:** ink/paper about **15.90:1**; new secondary/paper **6.03:1**; white/ink **17.19:1**; lime/ink **13.42:1**. Existing #758178 on paper is about **3.76:1**, so reserve it for decorative/large uses rather than ordinary 12–14 sp metadata. Lime on paper is about **1.18:1**: never use it as small text on cream. These are calculated pairs, not a blanket guarantee for photography, translucency, or every component. Include a role-level contrast check before approval.

### Token scales (React Native dp/sp)
- spacing: 0 / 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40.
- radius: 8 / 12 / 16 / 20 / 24 / pill (>= half component height).
- control heights: 44–48 minimum interactive hit area; primary CTA 52–56; search field 48–52; tab capsule 60–64 (visual, not including bottom safe area).
- page gutters: 20 on typical phones; reduce to 16 at compact widths <= 360 dp and 12 in constrained overlays. Avoid shrinking button hit targets.
- typography via system fonts (no download): display 30–34 sp / strong; title 22–26; section 18–20; body 15–16; caption 13–14; utility label 12–13 when legible. Avoid hardcoded 9–10 sp critical labels.
- focus/pressed affordances: scale or opacity (subtle) plus active background, disabled opacity paired with explanation. Never make color the only selected-state indicator.
- elevation: primarily contrast/surface and a restrained shadow, not mandatory blur, large 3D files or expensive composition layers.
- motion duration targets: short transitions ~120–240ms, optional reduce-motion suppression; no fake network progress.
- device/text settings: allow font scaling for meaningful content and design for enlarged text; truncate only noncritical decorative metadata.

## 2. Component inventory and contracts (A1 implementation, proposed paths)

Place future files under apps/mobile/src/ux004/ to avoid disturbing working experience code until tested.

| Proposed component | Responsibility | Minimum props / behaviors | A1 usage |
|---|---|---|---|
| ThemeProvider or plain theme exports | typed semantic color + spacing maps; no runtime theme toggle | mode = darkFeed / lightUtility; token helpers pure | adopted by shell and primitive wrappers |
| HybridScreenSurface | background, status-bar presentation and safe-area defaults | mode, children, scrollable?, bottomReserved? | wrappers for root screens |
| FloatingTabBar | Home / Explore / Create / Inbox / You capsule | activeTab, onSelectTab, onPressCreate, bottomInset | one control source for demo root |
| TactilePressable | consistent target size, feedback and disabled explanation | onPress, label, disabled, accessibilityHint, variant | nav item, button and chips |
| AppIcon | consistent Ionicons names + active/stroke styles | name, selected?, colorRole?, size? | icons without duplicating palette |
| ScreenHeader | title, subtitle, back/close/search action slots | title, mode, leftAction?, rightAction? | light utility screens |
| SurfaceCard | cream/white layer and outline/elevation contract | tone, radius, children | You/Explore container adapters |
| DemoDisclosure | visibly labels synthetic/demo functionality | concise label, variant, optional details | feed and utility surfaces |
| EmptyState | accessible explanatory empty state and clear next action | title, body, action? | Inbox and future searches |
| SafeBottomReserve | computes nav occlusion region for scroll/feed layouts | navHeight, bottomInset, gap | keeps last content reachable |

No new dependency. All components use React Native, installed safe-area-context and existing Ionicons. Accessibility labels originate from visible actions; avoid icons with no accessible name. If a primitive must be imported by the future connected experience, confirm it has **no fixture state or Supabase import**.

### File layout proposal
- apps/mobile/src/ux004/theme/colors.ts
- apps/mobile/src/ux004/theme/spacing.ts
- apps/mobile/src/ux004/theme/typography.ts
- apps/mobile/src/ux004/theme/layout.ts
- apps/mobile/src/ux004/theme/index.ts
- apps/mobile/src/ux004/components/FloatingTabBar.tsx
- apps/mobile/src/ux004/components/TactilePressable.tsx
- apps/mobile/src/ux004/components/HybridScreenSurface.tsx
- apps/mobile/src/ux004/components/AppIcon.tsx
- apps/mobile/src/ux004/components/ScreenHeader.tsx
- apps/mobile/src/ux004/components/DemoDisclosure.tsx
- apps/mobile/src/ux004/components/EmptyState.tsx
- apps/mobile/src/ux004/navigation/types.ts
- apps/mobile/src/ux004/navigation/useDemoNavigation.ts
- apps/mobile/scripts/ux004-a1-contract.cjs (small node:assert regression check if useful)
- apps/mobile/src/experience/DemoExperience.tsx — imports/adapts components incrementally; retains fixtures, sheets and interactions
- No changes required to apps/mobile/App.tsx, apps/mobile/metro.config.js, mobileApi, Supabase files, Prisma or payments.

The names are implementation **proposals**, not claims those files exist.

## 3. Bottom-navigation interaction specification

### IA / order / visual and accessible semantics
The ordered five slots are fixed:

| Slot | Role | Icon | Tap result | Selected state |
|---|---|---|---|---|
| Home | tab | home-outline / home | show dark Feed; retain feed index | lime pill + ink filled home |
| Explore | tab | compass-outline / compass | show cream Explore; retain local search/filter when switching back | lime pill + ink filled compass |
| Create | **action** | add-circle-outline / add-circle | show current explicit “Publishing unavailable in offline demo” explanation | **never** appears selected |
| Inbox | tab | chatbubble-ellipses-outline / filled equivalent | show cream empty Inbox | lime pill + ink filled bubble |
| You | tab | person-outline / person | show cream guest collections | lime pill + ink filled person |

Accessibility props per tab: role=tab, selected true/false, label Home/Explore/Inbox/You, clear hint when helpful. Create: role=button and label “Create content — unavailable in demo”, with explanation on press. Tooltips not assumed on mobile.

### Geometry (adaptive)
- Bar horizontal gutters 16 dp typical; 12 dp on narrow screens; rounded capsule radius >= 30.
- Bar **visual height** 62 dp target (60–64 acceptable); item hitbox min 48x48 dp, ideally 52; five equal-width slots with centered icons.
- Bottom offset = max(system safe area bottom, 8–12 dp); do not render under gesture bar. For Android 3-button navigation, measure bottom inset from safe-area-context and verify on a physical phone.
- Over Feed: dark solid/semitransparent capsule; if transparency is tested, text/icon contrast must remain valid over varying posters. Over utility: same dark capsule for consistency, with clear surface separation.
- Root content reserves **bar height + bottom offset + at least 12 dp breathing room**; scroll content padding must not simply end behind the capsule.
- Component owns its geometry; feature screens must not duplicate nav heights or hardcode sheet/offer distance by adding arbitrary “208” or “77” offsets.
- If window is 320 dp wide, distribute five min-48 dp targets inside remaining width without clipping. At large text scale, icons remain centered and spoken labels remain accessible.

### Tab selection and transitions
- Change tab only for Home/Explore/Inbox/You, keeping root tab identifier and last visited positions in local React state.
- Selecting a different tab closes only transient overlay UI by a documented rule; no surprise reset of synthetic likes/saves/comments, query, category, selected post or session state.
- Reselecting the current root tab is a no-op in A1: **do not** forcibly scroll feed to first post. A “tap again to scroll top” behavior requires separate approval.
- Create opens a clear demo limitation message. It does not push an active tab, request photo permissions, upload or save content.
- Tab switch must update StatusBar: dark Feed uses light-content; cream utility uses dark-content. Restore previous StatusBar when closing overlays.
- A1 does not invent screen-navigation stacks for profile/detail: existing modal sheets continue working. A2–A4 will add explicit child destinations later.

### Proposed navigation state contract (pseudo-types, no new router)
    RootTab = "Home" | "Explore" | "Inbox" | "You"
    DemoSheet = "comments" | "save" | "share" | "creator" | "offer" | "booking" | null
    Create = action, not a RootTab
    NavigationState = { activeTab: RootTab; activeSheet: DemoSheet; sourceTab?: RootTab }

Prefer a small hook/controller to prevent visual components from mutating unrelated screen state. The demo currently tracks feed tab, selected post, search, category, likes/saves, comments and booking preview locally; **do not migrate these to persistent/server storage for A1**.

## 4. Back, modal and keyboard contract

**Physical Android Back priority:**
1. If Android keyboard is visible, allow normal keyboard dismissal; do not navigate away or lose text.
2. If an existing modal/sheet is visible, its own Modal.onRequestClose closes only that sheet. No duplicate BackHandler must consume the same press.
3. If in a future child detail (not part of A1), pop that detail to its originating root/tab.
4. Else if the active root is Explore/Inbox/You, return to Home without resetting Home's previous feed position.
5. Else if already at Home with no overlays, allow the Android default exit/background behavior. Do not trap the user or invent an exit dialog.

Implement and **unsubscribe** BackHandler listeners in effect cleanup. Avoid racing status-bar changes with modal teardown. Preserve tab context when a sheet opens; closing it restores focus to the control that opened it where feasible. Android native Back must not trigger a booking preview submit, save toggle or any irreversible action.

### Navigation transition state matrix
| Origin | Event | Destination / effect | Preserve |
|---|---|---|---|
| Feed / For You post 3 | Explore tab | Explore cream screen | post index 3, For You selection, likes |
| Explore filtered Beauty | Home tab | prior Feed state | Explore query, category |
| Feed post offer | open offer | existing offer sheet over Feed | underlying post and tab |
| Offer sheet | hardware Back | same Feed post | no simulated request |
| Inbox | Create | non-publishing explanatory dialog | Inbox still selected |
| You collections | saved collection | existing saved feed | collection membership, back context |
| Utility tab | hardware Back | Home | current utility state in memory |
| Home root | hardware Back | normal Android default | no hidden modal |

### Presentation / overlay layers
1. content viewport / cards
2. in-screen controls and bottom content
3. global floating tab bar
4. native sheet/modal with proper scrim (when open, underlying bar must not steal touch)
5. system status/navigation/IME

The sheet owns its bottom inset and keyboard avoiding behavior, while tab bar owns root bottom inset. Never compound the inset twice. Use measured layout or centralized layout tokens to reserve content near the bar, particularly Feed's attached offer. Content must be accessible behind any keyboard, large system font and short screen.

## 5. Hybrid visual application by root screen

### Home (dark immersive)
- Keep current brand/search/top For You/Nearby/LIVE layout, synthetic illustration and demo badge for A1.
- Upgrade only shell surfaces, tab bar, safe-area spacing and typography roles; do not introduce real media assets or autoplay yet.
- High-contrast white feed labels; lime used for active state/emphasis on dark surfaces.
- The offer strip remains above the fixed nav. Caption/right rail cannot collide with offer/nav after safe-area calculations.
- Do not present the LIVE tab as an enabled stream.

### Explore (light)
- Cream page, dark readable title, white search surface, white creator cards, darker secondary meta text.
- Category selection must show shape/fill and readable text, not only a subtle hue difference.
- Preserve existing search and category filter behavior; reflow under 200% text scale without losing keyboard focus.

### Inbox (light)
- Cream empty state and distinct CTA “Explore Hustlers”; no fabricated conversation or “sent” state.
- Preserve fallback action into Explore.

### You (light)
- Cream page; white identity and collection cards. Retain “Demo guest / Offline preview”.
- Preserve collection-to-saved-feed functionality; no capability-switch UI.
- Offer no fake persistent account settings.

### Sheets / overlays
- Light sheet with dark text over media scrim. Dim background enough for reliable text contrast; do not overuse glass blur.
- Current comment/save/share/creator/offer/booking sheets remain functionally unchanged except A1 color/spacing/keyboard/back primitives.

## 6. Responsive design and test devices

Test on phone screen widths around 320, 360, 390 and 430 dp; compact height (~600dp) and tall Android screens; Android system font scales ~1.0x, 1.3x and 1.5–2x where feasible. These are target test conditions, **not** a claim that the current APK already passes them.

- Use useWindowDimensions and useSafeAreaInsets, but do not equate device pixel resolution to dp. Handle rotations/dimension changes without stale list card layout.
- The existing Feed uses pageHeight from useWindowDimensions and absolute overlays; A1 must at least centralize their bottom reserve. Full media/card repositioning can be completed in A2.
- Avoid fixed-height cards containing critical text that may wrap. Prioritize scrollability and accessible affordances over perfect screenshot similarity.
- Respect keyboard and hardware navigation mode; root tab bar must not intercept comments composer input, modal focus or Android gesture area.
- Do not assume a new font, blur package, Reanimated, React Navigation, expo-router or other library is installed. Propose any future addition separately.

## 7. Proposed A1 delivery increments (separate, small code PRs after approval)

### A1.0 — Baseline and branch protection
- Record current merged main SHA, working APK EAS build link and 7/7 physical phone acceptance notes.
- Confirm no file in src/ux004 currently used by production. Establish basic snapshots/screen checklist (no paid visual QA service).
- Preserve offline flag, React resolver and Expo build safeguards.

**Exit:** documented rollback/reference build and exact baseline.

### A1.1 — Typed theme and simple primitives
- Add token files, surface primitives, AppIcon, TactilePressable and an accessible DemoDisclosure.
- Apply tokens in **demo-only** wrappers on Home/Explore/Inbox/You; maintain functional behavior.
- Add token coverage and color-role tests; no broad replacement of App.tsx login or connected MobileExperience.

**Exit:** all four demo root tabs visibly follow approved Hybrid mapping; typecheck/Metro green.

### A1.2 — FloatingTabBar and root-tab controller
- Replace inline nav JSX in DemoExperience with FloatingTabBar and hook; maintain original five items and action semantics.
- Add right-sized touch targets, active/pressed states, width and inset handling.
- Keep feed and search local state when switching; no new nav dependency.

**Exit:** old 7/7 flow remains working; current tab and Create semantics unambiguous; no overlap.

### A1.3 — System Back, keyboard and safe-area pass
- Implement Back/Modal dismissal priority without double handlers; align status-bar mode with Hybrid surface.
- Reserve bottom region for feed offer/scroll content and utility lists; check short screens and large text.
- Keep all sample-only disclaimers visible and avoid any backend call.

**Exit:** physical Back/IME tests pass, no hidden CTA or lost reply draft.

### A1.4 — Integration gates and owner visual review
- Run cloud TypeScript, existing React-singleton, native autolink, Metro Android bundle and native Gradle diagnostic; add targeted node-based A1 contracts if needed.
- Provide code diffs + before/after screenshots **only if captured by running real UI**, do not claim unobserved screenshot outcomes.
- Merge only with owner approval and green exact-head checks. EAS Free Android build remains optional and separately manually authorized.

**Exit:** implementation PR reviewed; one new APK can be queued manually only when owner explicitly elects to spend a build allowance.

## 8. QA and acceptance matrix — measurable A1 sign-off

| ID | Scenario | Pass criterion |
|---|---|---|
| DS-01 | Theme coverage | Home/Feed remains dark; Explore, Inbox, You and all existing sheets are cream/light; nav capsule remains legible over both |
| DS-02 | Contrast | primary/secondary small utility text has >= 4.5:1 on solid surfaces; large text/non-text controls target >= 3:1; overlay contrast evaluated against actual backgrounds |
| DS-03 | Typography | important labels remain readable at enlarged system text; truncated decorative text cannot remove booking/demo disclosure |
| DS-04 | Tap targets | all nav and primary icon buttons >= 44x44 dp (target 48x48); centered even on 320dp width |
| NAV-01 | Tab order | Home, Explore, Create, Inbox, You in that order; exactly four root tabs |
| NAV-02 | Create semantics | Create does not become selected or publish; clear explanation and return to prior tab |
| NAV-03 | State retention | switching tabs does not reset likes/saves/comments, Feed post index, Explore query or filter |
| NAV-04 | Hardware Back | closes sheet first; returns utility→Home; Home allows native behavior; never submits a booking |
| NAV-05 | Safe areas | no nav collision with Android system bar, keyboard, offer strip or lower utility cards |
| NAV-06 | Modal behavior | sheets get focus/dismiss predictably; underlying nav does not react to taps under the modal |
| DEMO-01 | Integrity | all creators/locations/prices remain labelled as demo data; no real network/transaction |
| DEMO-02 | 7/7 regression | all seven owner-validated interactions still work on the updated build |
| BUILD-01 | Build | mobile TS, Metro offline Android export, React-singleton contract, Expo module metadata and native Gradle green |
| BUILD-02 | Device acceptance | APK installation and 10-minute crash-free device walkthrough; EAS completion is checked separately from GitHub queue success |

**Evidence expectation:** record PASS/FAIL and reproduction steps for each test; screenshots from owner phone or real simulator if available. CI can confirm dependency/build contracts but **cannot** certify legibility, gestures, keyboard, accessibility or phone stability without device execution.

## 9. Release boundaries and rollback

- **Permitted during A1:** design tokens, local sample UI state, native built-in animation, navigation shell/Back, accessibility semantics, read-only cloud CI contracts and offline fixture render changes.
- **Forbidden:** connecting demo to Supabase/real API; reading production credentials; changing auth, payments, booking, escrow, shipping or publishing; schema/migration changes; paid Figma add-ons; new databases; paid app build services; silent API calls; automatic EAS builds.
- Mobile demo environment must keep EXPO_PUBLIC_HUSTLE_DEMO=true with obviously invalid backend hosts; retain existing manual approve_free_demo_build gate. Do not share Expo secrets.
- Preserve Expo SDK54 package pins (expo-font 14.0.12 and @expo/vector-icons 15.0.3), mobile React19.1, root shared React and current custom Metro resolveRequest. Do not solve UI tasks with blanket dependency upgrades.
- Roll back A1 shell code to prior working main/physical APK if interactions or startup regress. Never delete the existing successful build artifact as part of this project work.
- Maintain additive PRs; no production release or rollout is authorized by this document.

## 10. Review decisions / out-of-scope questions

**Already decided (locked):** Hybrid dark Feed/future Live + light utility/screens and modal sheets.

**Not automatically decided by A1 approval:**
1. Feed CTA text and whether feed opens offer detail or initiates booking directly (A2/A4); existing action remains until separate approval.
2. Create button: existing clear disabled explanation is baseline; an offline non-publishing composer needs separate approval.
3. Video samples and media rights (A2).
4. Truthful verification/rating/trust indicators based on real data (A3/A4).
5. Any authenticated or production rollout (separate release gate).

A1 can begin after the owner reviews this document and approves the shell implementation scope. It does **not** require deciding A2–A4 functionality.

## 11. Definition of UX004-A1 complete

A1 is complete only when a reviewable implementation changes **only** demo presentation/navigation, follows UX004-ADR-001, passes the table above, preserves the prior working 7/7 interactions and mobile React startup safeguards, and succeeds in a new owner-approved physical-phone smoke test. Merely merging a documentation PR or achieving a green cloud bundle is not A1 implementation completion.

**Immediate next step:** review these documents in PR #143; after review, open a separate A1.1 implementation PR for typed tokens/components. Do not spend Expo build quota before an explicit new owner approval.
