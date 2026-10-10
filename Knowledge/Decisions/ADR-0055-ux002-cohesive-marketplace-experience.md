# ADR-0055 — Hustle UX-002: One Marketplace Experience

Status: MERGED PR #83 (`46c6747ca65431559a66b8a40fab1fd5464221fa`), Foundation CI `38050241323` SUCCESS 2026-10-10. Manual Web deployment and consolidated Monday visual/runtime acceptance PENDING.
Date: 2026-10-10

## Intent

The Hustle experience spans discovery content, skill search, attached offers, public storefronts, Bookings and Orders. It must feel like **one** mobile-first product, not separate developer-phase microsites. The owner requested a weekend implementation sprint with manual testing paused until Monday, October 12.

The existing UX foundation defined tokens and a mobile dock but individual pages still had dissimilar desktop headers, inconsistent edge gutters, mixed type scales and status chip semantics. Some customer-facing screens still said “Phase 11”, “Phase 12”, or that payment systems were upcoming despite authoritative finance already being implemented. Resolve these inconsistencies **without changing marketplace logic**.

## UX decisions

**Shared contextual chrome:** `ExperienceHeader` provides the same Hustle wordmark, desktop wayfinding for Discover/Search/Marketplace/Bookings/Orders/You, route-aware active page, compact breadcrumbs and contextual secondary navigation. Mobile is not a duplicate tab bar: the existing bottom dock remains the primary six-destination mobile control while the top presents clear context and relevant task actions.

**Public storefront exception:** Preserve anchored Services/Work/Shop/Reviews navigation and copy/share functionality. Keep a clear distinction between the visitor's own identity and the public Hustler's storefront. Offer and Listing pages breadcrumb back to Marketplace.

**Shared page grammar:** Opt-in `h-experience-shell` means consistent max-width, responsive gutters, warm paper, semantic colors and font stack. Opt-in `h-experience-hero`, `h-experience-heading`, `h-experience-surface`, `h-experience-content` align page intros, typography, accessible large tap targets, Search/Market filters and result cards. Do not globally rewrite all old CSS Modules or force compact cinematic Live layouts to match ordinary task pages.

**Trust-first states:** `ExperienceStatus` uses explicit words and restrained background/outline meanings. *Unpaid · pending* and *Payment pending* remain distinct from *Paid · confirmed* and *Funding confirmed*. Colors are supplementary; the canonical Booking/Order status comes from the backend, never a UI-generated payment assumption. Use the same component on Booking/Order list cards and authorized Agent detailed request.

**No product-phase language in consumer UX:** replace obsolete Phase labels and future-tense financial statements with the actual next action, payment authority and state.

**Accessibility:** active navigation uses `aria-current=page`; selected Discover/Search/Market mode controls use `aria-pressed`; breadcrumbs are labeled, interactive controls aim for 44px+ targets, keyboard focus remains visible, reduced motion preferences honored and chart/financial actions are untouched.

## Scope

- `apps/web/components/navigation/experience-header.*`
- `apps/web/components/navigation/experience-status.*`
- `apps/web/app/globals.css`
- Public Discover/Home, Search and Marketplace (shared results), Hustler Storefront, Service detail, Product detail, Booking list/detail, Order list/detail and Agent represented Booking detail.

No new schema migration, routing rewrite, role switch, AI claims, escrow/payment behavior or production deployment. Uses the same underlying URLs and action functions. The UX header does not authorize users or bypass domain guards.

## Monday design acceptance (must not be marked green on CI alone)

- [ ] Verify 320px, 360px, 390px, 768px, 1024px and desktop 1440px layouts, including mobile safe area on an actual phone.
- [ ] Navigate Discover → Search → Marketplace → public Hustler → Service/Product → Booking or Order → Account, with no broken links or duplicated confusing navigation.
- [ ] Public store sharing, primary call-to-action, Service Message-first, Product Add-to-cart, Booking manager/Agent and Order workflows unchanged.
- [ ] Verify color contrast, focus, readable headings and horizontal overflow absence.
- [ ] Verify payment status text matches API and does not imply that PENDING/ACCEPTED means paid; denied/revoked Agent cannot see represented Booking.
- [ ] Check loading/empty/error states on every updated route, especially Search and the two transaction managers.
- [ ] Owner explicitly approves Web deployment (manual workflow) when ready.
