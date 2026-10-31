# Hustle UI Preview — Connected Marketplace Milestone

## Scope (prototype, not production)
This branch is an isolated static Cloudflare Worker preview. All professionals, ratings, reviews, listings, chats, product inventory, prices, and appointment slots shown in these new screens are example data. There is no authentication, persisted customer content, backend request, real booking, live messaging, charge, escrow transaction, or production deployment.

## Design decisions
- Preserve the approved **content-first V1 Feed** and separate Stories viewer.
- Keep the five-tab bottom navigation: Home / Explore / Create / Inbox / Profile.
- Explore includes People, Services, Products, Training, Stories and Live routes, plus skill/location keyword matching (e.g. `barber in Lekki`).
- Marketplace is discoverable from Explore; has All / Services / Products / Training and skill filters.
- Each professional profile has portfolio/work, services, products, training and sample reviews, with Message / Follow / Hire-Consult affordances. Reviews and trust values are clearly labelled demonstrations.
- Posts' Hire/Buy buttons now open the corresponding detail page first, not the final transaction.
- A **service consultation precedes a hire**: requirements + location → preferred time/mode (not real availability) → review → local confirmation preview (not sent).
- Products use detail + options/quantity → cart → address/area sample → review → checkout demo, never charge.
- Inbox has conversation filters and thread screens. Messages are local session state only. Starting a chat with a new professional opens the correct thread, not an unrelated sample thread.
- A consultation can be discussed from a chat thread. Video and Live preview features remain as before.

## Code layout
- `ui-preview/dist/index.html`: existing Feed, Story, post media and Cloudflare preview entrypoint.
- `ui-preview/dist/hustle-flows.css`: adaptive styles for the integrated routes.
- `ui-preview/dist/hustle-flows.js`: standalone front-end flow module. It intercepts Feed profile/offer CTAs and bottom navigation, while leaving existing Feed interactions in place.
- `ui-preview/wrangler.jsonc`: static Worker deployment.

## Acceptance walkthroughs
1. Home → tap Tobi's name → Work / Services / Reviews → Signature haircut detail → Book consult → enter requirements and location → choose demo preference → review → finish. No requests sent.
2. Explore → search `barber in Lekki` → Tobi + haircut listing → service detail.
3. Explore → Marketplace → Products → Weekend meal box → select option and quantity → Add to cart → adjust quantity → Checkout preview → finish. No payment.
4. Inbox → select Tobi → compose demo message → view linked service and consultation CTA.
5. Explore → Stories or Live → opens original viewer / simulated room; Home remains scroll-snapping and media-first.
6. Back navigates between details and originating surfaces. The Home / Explore / Create / Inbox / Profile tabs still work.

## Validation in this implementation
- HTML index references both new files.
- New JavaScript compiled via `new Function` syntax check.
- 21 mocked-DOM screen/flow checks and 5 additional focused checks passed.
- Actual deployed Cloudflare Worker and iOS Safari layout **still require device validation**; these simulations are not browser-based end-to-end tests.

## Production integration deferred
- Expo/React Native screens and navigation must use native components; this static module is a UI contract, not shippable mobile code.
- Implement real provider search via service API, consent-based location and genuine availability.
- Introduce authenticated chat, uploads, threaded messages, moderation and notifications.
- Create consultation, quotation, milestone and escrow domain objects with authorization, idempotency, audit trails and disputes.
- Product inventory, stock reservations, order lifecycle, delivery pricing, actual payment gateway and refund policy.
- Verify what is currently implemented in the production app and preserve approved UI decisions before integration.
- Do not deploy, mutate the production database, or merge this preview code into the app without review.


## Additional milestone — Signed-in Profile, Posts, and Map

### Signed-in profile (preview account)
- Bottom-nav **Profile** now opens a full self-view, not a placeholder.
- Demo cover, avatar, display name, handle, bio, primary and secondary skills, sample following counts, edit controls, Posts, Work, Services, Products, Reposts, Saved and Reviews.
- Edit Profile saves fields only in the local page session; it is **not** connected to account auth or private user data.
- Create → Post accepts a caption and optional photo from the device (kept in-browser using an object URL), then adds a clearly labelled demo post to the signed-in account's Posts section.
- Saved posts are private to the demo session; placeholder reviews and stats must not be interpreted as verified.

### Posts separate from Work
- Creator profiles default to **Posts**, showing everyday updates and skill demonstrations independently of the curated **Work** portfolio.
- Explore includes a **Posts** tab. Top also surfaces posts alongside people, services and products.
- Posts search uses creator name, handle, skill, location, caption and attached offer keywords.
- Tapping a post opens full post details with local like/comment/save actions, profile navigation and attached service/product links.
- These post previews do not represent live publication or actual creator uploads.

### Map in Explore
- **Map** tab offers an interactive Leaflet map when the CDN and map tiles can load; professional cards remain available as a fallback.
- Uses OpenStreetMap raster tiles **only as the map is viewed**, without prefetching, offline caching or automated bulk tile downloads.
- Shows attribution to OpenStreetMap contributors. External map tile availability is best-effort and subject to OSM's tile usage policy; production should evaluate a dedicated tile provider as scale increases.
- Seven demo professionals have **approximate Lagos neighborhood-centre pins**, not their business's actual coordinates, verified addresses or true live availability.
- Search and category filters apply to map markers and the list below.
- Tapping a marker selects a creator and shows their card; popups open that professional's profile; Back returns to Map.
- Device geolocation is never requested automatically. **Use my location** explicitly prompts for user permission. GPS coordinates are held in memory for the preview; the browser's map-tile requests can reveal the approximate area being viewed to the tile provider.

### New acceptance journeys
1. Profile → Edit profile → Change bio and primary skill → Save → Profile shows new values (local demo).
2. Create → Post → Add caption and optional phone photo → Add demo post → signed-in Profile → Posts → tap created post.
3. Explore → Posts → search `barber in Lekki` → post from Tobi → tap attached service → consultation.
4. Feed → tap professional → Posts → switch to Work → inspect Services, Products and Reviews.
5. Explore → Map → zoom/pan → tap sample pin → view creator card → open professional profile → Back returns to Map.
6. Explore → Map → tap **Use my location** → browser requests permission; decline still permits map and list exploration.

### Verification
- Runtime tests: 15 signed-in profile, post, search, map and privacy checks **passed**.
- Additional 6 targeted checks for editing signed-in profile, map filtering, pin selection, profile popup and Back navigation **passed**.
- Existing 26 discovery/booking/commerce runtime tests were completed in the preceding milestone.
- JavaScript syntax validation passed.
- Full interactive Leaflet tiles and exact iPhone Safari appearance **not yet visually verified on the deployed site**.


## Additional milestone — Creator Create, independent Live hub and commerce-first Marketplace

### Create
- Full creator interface with **Post, Service, Product, Request and Training** tabs and a prominent **Go Live** shortcut.
- Post composer supports Photo, Video and Carousel choices; an optional local file selection, caption, location and attached service/product. Multiple photos (up to four) are previewable as a carousel. Locally created posts appear on the signed-in demo profile and are searchable on Explore.
- Service forms accept title, category, starting price, work area, mode and description, plus an optional local listing photo. Demo service listings immediately appear under the user's profile and in Marketplace; actual consultation-first hiring remains untouched.
- Product forms accept title, category, price, sample stock, size/style options and description, plus a local photo. Demo products appear in Marketplace and remain compatible with cart and simulated checkout.
- Customer Request forms include need, category, budget, area and description. Submitted demo requests become visible under **Explore → Requests** with an example request-detail screen. Nothing is actually sent to professionals.
- Training forms include title, skill, sample fee, format and description. They appear under the signed-in profile's Training tab and Marketplace Training tab.
- Draft forms use only in-memory state. Local media object URLs are not uploaded or sent to a backend. There is no authenticated publishing, inventory persistence or real offer submission.

### Live discovery and Go Live
- **Explore** includes a visible LIVE shortcut; its Live tab opens a **separate Live Hub**, not a Feed story or scrolling post.
- **Create** contains a Go Live button and creator Live promotion; Marketplace includes a Live commerce entry point.
- Live Hub supports For You / Following / Nearby and category browsing with clearly marked simulated rooms, example audiences and creator imagery.
- Tapping a room opens a full-screen demo with local comments, hearts, follow toggle and pinned offer detail navigation. There are no connected streams or viewers.
- **Go Live setup** has title, category, audience, optional pinned offer, and explicit optional camera-preview permission. Camera never opens by default; a camera preview is local and never broadcast. Streams are stopped on exit or when leaving the host flow.
- Starting a Live simulation opens the host studio, with local chat/test hearts and End Demo control. **No livestream or real audience can be created from the preview.**

### Marketplace as commerce
- Marketplace now has a product/store search bar, rotating editorial promotional banners (labelled **sample promotions**, not genuine paid ads), visual category tiles and All / Products / Services / Training filter tabs.
- Listing cards are product-forward with square imagery, sample prices, creator attribution and location cues. Price low/high sorting and textual matching are functional.
- Dedicated Live-shopping banner opens the Live Hub; Product detail → Cart → Checkout remains a non-paying simulation.
- The previews show no fabricated verified ads, discounts, inventory guarantees or payment success claims.

### Test walkthroughs
1. Create → Post → Photo/Video/Carousel → add optional media and attached service → submit → signed-in Profile Posts → view full post.
2. Create → Service or Product → fill mandatory details → submit → own Profile listing tab → Marketplace listing detail.
3. Create → Request → submit → Explore Requests → inspect request.
4. Create → Training → submit → Profile Training tab and Marketplace Training.
5. Explore → LIVE → Live Hub → select creator → chat, hearts, pinned offer → Back → Go Live setup → optional camera permission → simulated host studio → End.
6. Marketplace → rotate promotional banner → category tiles → sort prices → Product details → Cart and simulated checkout.

### Quality gates
- Static JS parses and all linked CSS assets are confirmed on the preview branch.
- 16/17 first full-journey checks passed; the one failure was a **test setup selecting the previously active Training tab rather than Post**, not a runtime exception. A correctly selected Post was then rechecked successfully.
- Additional 8/8 regression tests passed: demo Post creation/search, independent Live hub, local Live chat, optional camera-off state, existing product detail/cart, and existing service consultation.
- iPhone Safari visual QA and Cloudflare's latest build/deployment remain to be verified.
- This is an isolated **Cloudflare preview branch only**. No production app, production database, payments, livestream service, ads network or real account was changed.

## Additional milestone — Discoverable Map and immersive Live Feed

### Discovery-first Map placement
- The Map is no longer discoverable only through the later **Map** tab. **Explore → Top**, before the user enters a search, includes a prominent illustrated interactive skill map card above the search field, alongside the existing Marketplace discovery entry point.
- Miniature skill markers are clickable, distinguish categories using icons and colors (e.g. 💈 Barbering, 🧵 Fashion, 📷 Photography, 🍳 Cooking, 🏠 Home, 👗 Styling and 💐 Floral design), and have subtle entrance/selection motion. Respect reduced-motion preferences.
- Once a user enters a search, matching map previews are included **in the results**, including Posts searches, with a direct **View map results** action.
- The full **Map** tab continues to provide interactive OpenStreetMap/Leaflet pins, marker selection, service/profile links and opt-in geolocation. Approximate Lagos neighborhood examples are **not verified provider locations**.
- No GPS permission is requested merely by opening Explore; live location remains opt-in.

### Live entry on Home and TikTok-focused Live discovery
- A visible small **● Live** tab sits next to Following, For You and Nearby on Home. It routes into the dedicated Live discovery experience, not Stories.
- The separate **Live Hub** now uses **full-screen, vertically snap-scrolling creator previews** (one at a time), rather than a card grid or standard Explore listing page.
- Full-screen previews show creator identity, sample skill, example pinned commerce offer, on-demand Like/Follow/Chat actions, and a prominent **Enter demo Live room** action.
- Floating top navigation offers For You, Following and Nearby; compact skill filters remain available. Users can swipe to the next preview, use keyboard arrows in supported environments, and navigate to a detailed simulated Live room.
- The bottom navigation is hidden while immersed in the Live experience; the close control returns to the originating context. Returning from a Live room restores the previously selected preview.
- Existing interactive Live room chat, simulated hearts, pinned offers and Go Live setup/studio are preserved. No stream, viewers or realtime services are actually connected.
- Demonstration labels make clear imagery is not live video. Production video-stream preview requires an authenticated livestream provider and genuine availability.

### Quality checks
- 18 targeted preview-runtime checks passed for Map card before search, category pins, matching Map previews in Posts search, direct Map route, Home Live entry, Live full-screen composition, snap-scroll behavior, filters, Live room navigation, back routing, camera opt-in, backend isolation and reduced-motion CSS.
- JavaScript syntax and CSS references were validated. **The Cloudflare worker deployment and the actual iPhone Safari layout have not been visually verified by these checks.**
- All changes are on isolated branch `preview/hustle-v1-posts-stories`, with no production deployment, database changes, real uploads, bookings or payment transactions.
