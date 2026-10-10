# UX-002 Core Marketplace Harmonization — Build & Laptop QA

Status: Feature branch implementation; PR/automated CI and owner Monday acceptance pending.

## Implementation evidence
- [ ] Shared contextual desktop navigation, breadcrumb hierarchy, no conflict with existing mobile dock.
- [ ] Consistent responsive page width, typography, warm paper, surface cards and filter gutters.
- [ ] Discover, Search, Marketplace selected modes accessible to keyboard/screen readers with aria-pressed.
- [ ] Public Storefront retains anchor section navigation and sharing; Service and Product pages retain original offer actions.
- [ ] Bookings/Orders status pills have explicit text for authoritative paid vs pending and are independent of financial mutation logic.
- [ ] Obsolete internal Phase 11/12/13 customer-facing labels removed from touched listing/Service pages.
- [ ] Monorepo Web/Admin/Mobile/API CI typechecks/builds pass; isolated payment regression unchanged.
- [ ] PR merged with green checks; no auto deployment.

## Monday 2026-10-12 laptop review
- [ ] Desktop: 1024/1440px — desktop links, max width, storefront sections, grids, hover affordances.
- [ ] Mobile: 320/360/390px — mobile dock, safe area, page headings, forms, focus, touch areas; no accidental horizontal overflow.
- [ ] Tablet: 768px — columns stack without misalignment.
- [ ] Discover tabs, feed media and offer quick views work.
- [ ] Search tabs/filters/result deep links and Marketplace attached offer purchase links work.
- [ ] Public storefront shares correctly, profile → Service/Product preserved, media readable.
- [ ] Service → message/Booking and Product → cart/checkout preserve business logic and status truth.
- [ ] Bookings/Orders pages, detail, delegated Agent request detail, notifications and payment boundaries remain protected.
- [ ] Compare one empty/loading/error state in each major area; no technical stage language or invisible controls.

Do not consider this visual QA accepted merely because CI passes. The owner deliberately postponed manual acceptance and production deployments until Monday.
