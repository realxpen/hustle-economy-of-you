# Immersive Discovery — acceptance

State: PR #88 MERGED 2026-10-10; Foundation CI 38088362956 SUCCESS on final head a526e90fdc40f25f444304d6504600c95698f21e; owner-controlled production Web release and real browser/device acceptance PENDING.
Scope: apps/web/app/home; no backend or finance changes.

## Automated checks
- [x] GitHub Foundation CI Web/Admin/Mobile/API typechecks and Prisma generation, Web/Admin/API production builds passed on final head (38088362956).
- [x] PR contains only Web Discover TSX/CSS and Knowledge documents; no API/database/payment/Agent changes and no deployment initiated.

## Visual and interaction acceptance (NOT run)
- [ ] At 320/360/390px light/dark mobile, opening /home places **one real Post** in the immersive area, not a marketing hero or an ordinary card list.
- [ ] At 768/1024/1440px, portrait media is dominant and centered; secondary navigation occupies a smaller adjacent panel where space allows.
- [ ] Mouse wheel/touch scroll: exactly one sequential Post snaps into view; keyboard focus permits scrolling; horizontal image galleries still swipe sideways.
- [ ] For You/Nearby/Connections still use their actual server tabs, and Live links to /live without fake tab content.
- [ ] Like/save optimistically toggle with API rollback on failure; comments open actual discussion, share uses real link and follows are backed by the existing API.
- [ ] Verified label displays only for verified creators; profile link and attached service/product modal preserve original instrumentation, exact price and booking/order paths.
- [ ] Offer drawer starts collapsed, can open/close, multiple real offers remain reachable and buttons never interfere with vertical swipe or native video controls.
- [ ] First native video is muted, plays only when >=55% visible where allowed, pauses on leave/hidden/unmount; reduced-motion disables automated playback, YouTube remains user controlled, no unexpected sound.
- [ ] Single image post shows complete image without cropping important content; landscape imagery uses softly dimmed background.
- [ ] Loading, empty, error and text-only posts are intentional and readable; append failure displays retry without hiding loaded posts.
- [ ] Cursor auto-load fetches exactly once per in-flight page near end, no duplicates/stale-tab contamination; a manual load button remains.
- [ ] No dock/composer/status bar overlap at 320/360/390px and safe areas; light/dark text meets contrast; focus and labels available by keyboard.
- [ ] Owner compares actual deployed screenshots with reference intent at 100% browser zoom after authorizing Web release.

## Constraints
No screenshots or hands-on device/runtime acceptance have been performed by the owner for this PR. A green CI does not establish visual acceptance or authorize deploying to production.


## Owner's first post-first production screenshots — 2026-10-11
The owner manually released PR #88 and supplied two desktop Chrome captures of `/home` with a single genuine image post. The new action rail and attached offer toggle are visible and post content leads the stage, but the whole browser document still scrolls vertically, placing the post's identity/offer area below the fold. The stage remains horizontally too wide for an immersive portrait player and the right-hand promotional/search/stories pane competes for attention. This is visual evidence of layout incompleteness, **not** proof of functional scrolling, video playback, permissions, or booking tests.

Viewport focus correction (PR pending): constrain the Discover document to 100dvh, minimize header to one row, keep the feed in a 9:16 stage with independent vertical snap, simplify the sidebar to useful real navigation, preserve Create via toolbar icon, add keyboard Arrow/Page Up/Down when feed stage is focused, and reserve room for mobile floating dock/safe area. Follow-up browser/device acceptance remains required.

- [ ] Confirm mouse wheel/touch scroll moves posts inside the feed rather than scrolling the document, with multiple actual posts.
- [ ] Confirm creator, caption and attached offers are all accessible without outer page scrolling at 1366×768 and 1440×900, 100% zoom.
- [ ] Confirm inner feed vertical stage shows whole real image on desktop (9:16) and fills available mobile screen without docking overlap.
- [ ] Confirm toolbar Create (+), Search, tabs, Live, original navigation, Stories, direct booking quick view and keyboard Next/Previous.
