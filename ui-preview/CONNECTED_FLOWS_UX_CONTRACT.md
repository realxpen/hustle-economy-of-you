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
