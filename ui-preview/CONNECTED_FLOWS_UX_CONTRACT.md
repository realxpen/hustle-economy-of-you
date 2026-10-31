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


## Live discovery versus full Live room — screenshot-aligned UX milestone

The user supplied two reference screenshots demonstrating the distinct TikTok Live states: a quiet full-screen Live preview while scrolling in a normal content feed, and an interactive room entered after tapping.

### Discovery (no chat until entering)
- The Live entry on Home opens a vertically snapping preview feed.
- Discovery shows one large video/photo preview at a time, with top **For You / Following / Nearby** discovery filters, a small demo Live status, creator name, and **Tap to watch LIVE**.
- No public chat messages, pinned product card, gifts, or room-specific controls appear in preview mode. Tapping the preview (including its prompt) enters the room.
- The Flora Studio example includes a muted, looping public sample flower video using `https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4`. This is a test clip, **not an actual creator livestream**.
- Other preview rooms use still photographs, clearly labelled as demo stills, until a true streaming source is available. Do not display a photograph as if it were actual live video.
- Inactive sample videos are paused on swipe. Reduced-motion preference is respected; video availability on actual Safari/iPhone remains to be verified. Preview video error falls back to a still image.

### Inside the Live room
- After entering, the room displays the media, host identity, example viewer count, Join/Follow, the active comment stream, a pinned product or service, text chat, hearts and a **free demo gift** control.
- Interacting with chat, Join, hearts and demo gifts updates local UI state **without re-rendering/restarting** the sample video.
- No real audience, livestream connection, monetary gift, chat delivery, order, or payment is implied. All controls remain local demonstration interactions, with no real broadcasts.

### Verification
- Fourteen runtime checks passed for preview media, swipe behavior, preview exclusion of room chat/gifts, room entry, pinned service, chat, gift/heart/Join without media reset, back navigation, Home Live access and lack of camera permission requests.
- Code and styles are present on preview branch. **Could not verify the latest Cloudflare deployment or actual iPhone Safari visual layout in this session.**

## Shopping navigation and Payments & Earnings decision

### Discoverability and navigation
- Preserve the **five** main tabs: Home / Explore / Create / Inbox / Profile.
- A compact **Shop** action and accessible **Cart** icon are visible in the Home header beside Stories. Home also retains the separate Live entry. To avoid crowding on small iPhones, appearance and the demo notification shortcut have moved to Profile → Settings.
- Home Cart displays a quantity badge calculated from cart line-item quantities. Zero hides the badge; adding/removing/changing quantities updates it.
- Explore shows **Marketplace** and **Cart** shortcuts under the search box. Marketplace remains reachable from Explore content recommendations and creator offers.
- Marketplace header has its own Cart shortcut. Product details lead to Cart via Add to Cart. Cart has **Continue shopping** while preserving existing line items. Back navigation returns to the originating screen.
- Signed-in Profile now includes Shopping & Earnings with **Marketplace**, **Cart**, **My orders** and **Payments & earnings**. My orders has an honest empty state, not fictional purchases.
- All these actions route to the same local cart and listing state, not separate or duplicated carts.

### Wallet architecture — decision for MVP
- Customers **must not be required to pre-fund a Hustle wallet** to buy a product or pay for a service. Support direct provider-powered checkout at launch after technical, legal and provider review.
- Professionals need a **Payments & earnings** view to track available earnings, settlements, pending payouts, fees and transaction history once the authorized financial systems are connected.
- Clients need booking/payment statuses, order history, refunds/disputes and protected service-payment milestones. This is a financial **ledger/status dashboard**, not a claim that Hustle operates a stored-value account.
- A full stored-value wallet with deposits, transfers, and withdrawals should be deferred until a specific commercial need, regulated provider architecture, KYC/AML controls and applicable approvals have been reviewed.
- The CBN's published Mobile Money Services framework regulates mobile-money wallets and related activities; do not assume a marketplace may independently issue electronic money or custody customer funds.
- Production escrow/payment protection is **not implemented** in this preview. Provider capabilities and compliant legal structure must be confirmed before promising financial protection or releasing real funds.
- Prototype Payments & Earnings shows dashes and explicit 'not connected' labels instead of fabricated user balances. Payout-account connection is visibly unavailable. No payments or withdrawals are possible.

### Acceptance walkthrough
1. Home → Shop → product → Add to Cart → Cart → Continue shopping → Cart; changing item quantity updates the Home cart count.
2. Home → Cart opens without visiting Marketplace first, including empty state.
3. Explore → Marketplace or Cart; Back returns to Explore.
4. Profile → Shopping & Earnings → Marketplace, Cart, My orders, Payments & earnings; Profile → Settings retains dark mode and demo notifications.
5. Payments & earnings → Overview / Activity / Payouts displays only explicit placeholder data. Nothing is deposited or moved.

The source and DOM interaction tests pass; actual iPhone visual layout and Cloudflare deployment were not confirmed in this session. Work remains isolated on `preview/hustle-v1-posts-stories`, not production.


## Wallet, Escrow, Hustler Studio, Agent Studio and internal Admin — Isolated milestone

### Connected preview
- New standalone assets: ui-preview/dist/hustle-operations.js and ui-preview/dist/hustle-operations.css, included in the static preview.
- Profile → Shopping & earnings → Wallet & escrow; Profile → Workspaces → Hustler Studio or Agent Studio; Create → Hustler Studio; Profile → Settings → Internal tools → Admin Console design sandbox.
- Five-tab primary navigation, Feed, Stories, Live, Marketplace, Cart and Booking remain intact. Closing a workspace returns to the originating screen.

### Wallet and protected payments
- Wallet overview with **SIMULATED DATA** label, sample NGN balance, example escrow totals, earnings and transaction history.
- Add Money with a sample Card or Bank transfer choice, amount presets and validation. Changes are only in-memory demo transactions, with no real bank credentials or payment network.
- Withdraw Earnings previews a payout request subject to sample available earnings. Payout account, KYC and real transfers are not connected.
- Escrow management shows held/disputed/completed states, milestones, amounts held versus released, agreement details and timeline.
- New demo escrow checks simulated wallet funds, deducts a sample amount and creates two milestones. Client-side release requires confirmation; dispute freezes remaining held milestones. An Admin inspecting an escrow cannot use client controls.
- Admin sandbox dispute decision can simulate a refund or release with explicit confirmation and in-memory audit trail; refunds return remaining held demo funds to the sample client balance.
- Consultation completion links into the protected-payment demo. Checkout offers Card, Bank transfer and Wallet (demo) interfaces without charging or submitting orders.
- Direct customer checkout should remain possible without wallet prefunding.

### Hustler Studio
- Overview, Bookings, Listings, Insights, and Earnings.
- Sample enquiries, job/quote status, accepting-enquiries toggle, creator listings, performance metrics, and wallet shortcut.
- Professionals cannot authorize their own client escrow releases.

### Agent Studio
- Agent application stays pending after submission. A separate explicit action previews an approved-agent dashboard.
- Talent management, invitation workflow, delegated bookings, contract-based commissions and approval queue.
- Agent permission does not mean shared wallet custody. Hustler withdrawals remain blocked pending that hustler's own face/identity verification with a suitable real provider.

### Internal Admin Console
- Accessible only as an explicitly labelled internal *design sandbox*, not as a normal main tab and not as real authentication.
- Dashboard, Moderation, Escrows, Users, Finance and Audit views.
- Content moderation sample decisions, flagged listings, identity checks, agent applications, dispute handling and auditable sample actions.
- Production admin must use server-side authorization, MFA, least privilege, immutable audits, evidence review and controlled release approvals. The frontend sandbox role switch is not a security mechanism.

### Real-money architecture deferred
- None of the preview actions sends transactions, publishes content, changes production DB records, makes transfers, or provides real escrow protection.
- Production financial handling requires a suitable regulated payment/custody partner, legal review, provider-controlled settlement, idempotent APIs, authenticated webhooks, double-entry ledger, reconciliation, KYC/AML as applicable, dispute evidence and carefully scoped release permissions.
- Do not deploy or merge the static concept code into the real app as though it were a working wallet.

### Verification
- 9/9 script/asset and basic safety checks passed.
- 25/26 mocked workflow assertions passed; one failed solely because the test searched for an unescaped ampersand rather than the correctly escaped HTML entity.
- 11/11 cross-module navigation, studio entry and checkout checks passed.
- 12/12 Admin read-only, agent authorization and dispute regression checks passed.
- Latest preview branch code is committed. Cloudflare deployment and actual iPhone Safari visual QA are not yet verified.


## End-to-end journey milestone — Auth, Onboarding, Booking, Payment, Reports, Notifications, Agent Assisted Setup

### Navigation and design
- New isolated preview modules: ui-preview/dist/hustle-journeys.js and ui-preview/dist/hustle-journeys.css.
- Preserves V1 feed, Stories, immersive Live, Explore Map, Marketplace, Cart, Profile, Wallet/Escrow, Agent/Hustler Studios and Admin sandbox.
- UI components share the approved tactile-soft lime visual language: consistent headers, inputs, buttons, progress indicators, status cards, confirmation dialogs, safe-area padding, loading/splash animation, touch target sizes and reduced-motion behavior.
- No deployment or changes to the production application or production database.

### Splash, guest access and authentication
1. On first visit in a browser session, show brief animated Hustle splash and simple welcome.
2. Welcome offers Start, or **Explore as guest** without requiring a contact or account.
3. Unified sign-in/new-account entry accepts phone or email (not passwords) and simulated six-digit OTP. The preview openly displays code 123456 and sends no SMS/email; it is *not authentication*.
4. First-time preview account personalization: choose Discover, Hire, Offer Skills or Both (one account can do both), display name, optional username, skill and area, optional future notification preferences. No precise location permission at signup.
5. Successful onboarding updates the local demo user's display and routes to Hustle. Returning demo user in the same page session does not repeat onboarding.
6. After dismissing the intro, reload within the browser session skips first-launch splash to avoid repeated friction. It can be replayed from Profile → Settings → Preview welcome & splash.
7. Real deployment needs verified login session issuance, safe OTP rate-limiting/expiry, replay protection, device/session revocation, consent recording, privacy controls and account recovery.

### Booking / consultation / quote / payment / escrow / review
1. Service detail or chat → Book consultation.
2. Customer describes work, references and area → chooses demo consultation mode/day/time.
3. Preview professional quote → accept or request changes; never pretend the professional has actually confirmed a slot or quote.
4. Choose a demo payment method. Protected-payment preview creates a matching example escrow record in Wallet.
5. Work progresses through separate 40/60 demo milestones; client release requires confirmation and affects the matching escrow milestone.
6. Raise dispute to freeze remaining demo milestones; internal sandbox review can simulate adjudication.
7. Once milestones are released, mark completion and leave an optional demo review. Notifications show example status events.
8. Production needs provider confirmed bookings, consultation scheduling, quotation versions/acceptance, itemized milestones, payment authorization, dispute evidence, client/server role scopes, release controls and reconciled double-entry ledger.

### Product payment journey
- Product detail / Cart → delivery details → review → choose Card, Bank transfer or Wallet (demo) → simulated result / tracking reference.
- No actual product is purchased, stock is reserved, payment is charged, wallet is debited, or seller notified. Wallet prefunding should remain optional.
- Production must handle tax, delivery estimate, fees, inventory reservation, order idempotency, settlement, refund, tracking and reliable notifications.

### Report / safety journey
- Report actions from Feed post, creator post, profile, listing, conversation and Live room.
- Select reason → optional contextual detail and local screenshot selection → review/confirm → receive case reference → My reports case tracking.
- New demo report also creates an internal Admin moderation queue item. Admin's sample decision updates the report's demo case status and adds a local notification.
- Production requires secure evidence upload, abuse controls, privacy, case state machine, severity/safety routing, appeals and immutable moderation audit log. Do not expose reporter identity to reported accounts without appropriate legal/policy grounds.

### Notifications
- Accessible from Inbox and Profile Settings. Categories: Booking, Money/Escrow, Orders, Activity, System.
- Unread/read states, Mark all read, per-category preferences and deep links to journey screens.
- Journey events such as quote/payment, escrow milestones, dispute, onboarding, report submission and agent invitations add local sample notifications.
- No real push permission request or message delivery occurs. Production requires event-driven notifications with user preferences, deduplication, consent and unread synchronization.

### Agent onboarding (existing professional vs new low-tech professional)
- Approved agent enters Agent Studio → Add talent → select Existing user or New/assisted onboarding.
- Existing: search and select an existing Hustle profile without revealing contacts → review permissions → generate invitation that user independently accepts or declines.
- New: collect only minimum provisional information (name, skill, optional area), choose explanation language (English, Yoruba, Pidgin, Igbo, Hausa, Other) and handoff method (in person, voice assisted, printed card).
- Agent explicitly acknowledges explanation and anti-impersonation rules before preview invitation.
- Invitation remains Pending; a separate **Professional confirmation** screen shows exactly what access is requested and prohibits funds, withdrawals and escrow releases.
- Professional accepts with explicit acknowledgement or declines. Agent-side attempt to accept directly is blocked in preview.
- Agent cannot collect or use the professional's OTP, impersonate them, withdraw their money, access their wallet balances or release client escrow. Actual account ownership/verification must remain with the professional.
- In production invitation issuance must be server verified, time limited, one-use and limited to per-user delegated permissions, with revoke/expiry controls and hustler-owned identity/face verification on sensitive actions.

### Quality verification
- 22 simulated journey assertions passed for guest/auth/onboarding, notifications, report queue, booking/escrow milestone, dispute, checkout and new-agent consent.
- 11 additional updated journey assertions passed for one-time splash, repeat sign-in, existing/new agent invitations, professional approval and decline.
- Source syntax, module references, iPhone safe-area/reduced-motion rules, demo-only financial/auth safeguards and report/notification hooks passed 14/14 static checks.
- These checks are mocked DOM and source validations. **They do not confirm Cloudflare finished deploying or that all screens have been visually tested on iPhone Safari.**
