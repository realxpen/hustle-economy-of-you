# Immersive Discovery — acceptance

State: Implemented in branch feat/discover-immersive-snap-feed, CI pending, owner/browser acceptance pending.
Scope: apps/web/app/home; no backend or finance changes.

## Automated checks
- [ ] GitHub Foundation CI Web/Admin/Mobile/API typechecks and Prisma generation, Web/Admin/API production builds succeed on final head.
- [ ] No API/database/payment/Agent changes and no deployment initiated.

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
