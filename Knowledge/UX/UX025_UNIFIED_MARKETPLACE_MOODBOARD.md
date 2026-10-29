# UX025 — Unified Marketplace: services, skills and products

## Founder source and intent
Founder supplied ten Pinterest reference images (cleaning service marketplace, appointment calendar, service provider dashboard/details, product catalog, product detail, project tracking, message attachment sheet, travel booking) and asked to **combine product + skill/service marketplace** while retaining the ability to focus exclusively on one.

These images are *design references*, not licensing to copy logos, ratings, photographs, branding or fake content. They inform layout hierarchy, compact cards, photography, category selection, booking date/time and messaging attachment presentation. Later booking/messaging adaptations are tracked separately, not silently merged into this Marketplace PR.

## UX decisions
- One Marketplace URL and one client/Hustler identity. The market is a **single discovery surface** with three visible modes: **Everything**, **Services & Skills**, **Products**.
- Default **Everything** deliberately requests two real published-listing endpoints (Services + Products), six each, displaying distinct service and product sections with genuine canonical links and *See all* controls. A single backend all-ranked page could show only one kind in its first page, misrepresenting the combined marketplace.
- Focused modes use their real typed API endpoint with cursor pagination (12/page), preserving backend ranking, category/location/price filters, moderation and publication protections.
- Mode is a shareable query parameter `?view=services` or `?view=products` (also `?view=skills` → services). Category and keyword are preserved in page URLs; neither mode creates a separate role or account.
- Visually: Service cards show actual work imagery, pricing and the professional; Product cards use square catalog images, pricing and owner. No invented ratings, stock, discounts or testimonials. Search-approved forest (#18281E), lime (#C9F26B), pale-green (#E4EFD7), cream (#F7F6F2).
- Filter surface is collapsed until needed. Quick category chips are derived only from loaded published offers, not a fabricated/global taxonomy. Applying a delivery-mode filter must not invisibly hide products; product-type must not invisibly hide services.
- Product actions go to existing product detail/real cart; Service actions go to the existing service detail/real consultation-booking. No direct unverified payment, fake Hire, or imitation checkout.
- All cards remain ordinary links even when optional observation capture fails. No API/auth/data/finance/escrow/messaging changes.

## QA
- Automated pure TypeScript test covers mode parsing, shareable deep links and cross-type filter sanitization.
- CI contracts require real typed endpoints, publication-derived categories, canonical URLs and seller identity.
- Local synthetic responsive Chromium Marketplace journey tests both category sections, typed focus, shareable deep link, narrow viewport and zero writes (separate script extension).
- Founder iPhone Safari/PWA visual acceptance remains pending until PR is merged and separately deployed to isolated AWS preview.
- PR UX024 for Booking/Service/Message redesign is still separately open as of PR creation; no accidental merging of its unapproved changes.
