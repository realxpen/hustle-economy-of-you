# UX019 — Figma Explore + intelligent search

Design source: Figma Mobile Experience V1, node 6:2.
Design intent: calm utility hierarchy (title, 51px search, compact skill chips, Explore nearby schematic, authentic featured professionals, five-icon dock).

## Implemented
- Mobile Search/Explore follows Figma's structural layout; the older marketing-style hero and giant search cards are hidden in this surface (Marketplace untouched).
- Search as you type: a single character offers labeled *search prompts* (not claimed matches); from two characters, debounce 280ms and retrieve real Top People, Posts, Services and Products from the **existing** protected public/authorized search endpoint, respecting publication rules.
- Suggested published matches carry their true result type and canonical deep link. Explicit Search submit still runs the normal backend, tabs and filters; full results have concise mobile rows.
- Recent submitted suggestions stored only in browser sessionStorage, with clear control. No external autocomplete provider or tracking.
- No match: honest empty state and suggested broader search terms; if a filtered tab is empty, query Top using the SAME term and show only real published cross-type results. Do not fabricate matching providers.
- Nearby: real queryless Marketplace browse with editable **textual** area (default Lagos, manually changeable), only published owner profiles and work. The map-style artwork is decorative and explicitly NOT GPS coordinates or a live map. No fake ratings, pins, distances or verification badges.
- Existing analytics, result links, booking, auth and pagination preserved.

## Limitations / release gate
- Search backend is lexical matching (ADR-0008); this does not magically provide semantic query understanding, learned personalization, live geospatial distance or an interactive street map.
- Browser CI validates public read-only GET fixtures at four viewport sizes and renders images for review. Inspect actual iPhone Safari / installed PWA screenshots at 320, 375/390 and short-height; check keyboard overlay, typeahead tap, tab filters, real published results, empty states and area editing. CI green is not screenshot fidelity approval.
- Do not suggest map pins or specific Hustler reviews in production unless backed by real location and trusted review records. No payment or production deployment work.
