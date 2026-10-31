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
