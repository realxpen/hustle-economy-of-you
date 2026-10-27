# UX015 — Figma V1 Fidelity Reset (Founder Visual Review)

Status: Proposed PR; real iPhone screenshot comparison REQUIRED.
Reference: https://www.figma.com/design/psxnn95X8nPqEEp7IvEw5s/Hustle-%E2%80%94-Mobile-Experience-V1?node-id=2-18
Baseline: Founder-supplied PWA Feed, Inbox, TikTok comparisons and the actual Figma screenshot, 27 October 2026.

## Decision

The previous UI had Figma colors but NOT Figma hierarchy. Visual fidelity is a first-class release requirement. This branch uses actual Figma get_design_context for frame 2:18, translating layers to existing React/Next, while retaining connected posts, likes, social actions and offers.

## Measured reference

390x844 frame. Brand at upper left (~23px), Search upper right. LIVE / For You / Nearby with lime selected underline, image/video dominant, creator @handle and caption near bottom, compact four-action rail, single attached service CTA near bottom, small five-icon dock. Figma geometric art is placeholder artwork, NOT user-media to embed.

## Actual implementation

- All mobile Safari and installed PWAs: remove the duplicated desktop ExperienceHeader. Brand + genuine search link and compact Live / For You / Nearby. Move Connections into an accessible More-feeds menu rather than removing the backend view.
- Phone media is full-bleed with object-fit:cover, never contained inside a separate blurred card. No fabricated media.
- Overlay @creator, minimal Follow, real caption, four functional rail actions with no decorated discs, and a compact offer.
- When exactly one real service/product is attached, open its canonical OfferQuickView directly. Multi-offer posts retain real expandable cards. Original analytics source and booking/cart paths remain.
- One visible 5-tab dock in normal Safari and installed PWA, identical to the existing native mapping. Activity remains reachable through You, Marketplace through Explore. Browser's former 6-destination nav stays in the DOM but hidden on mobile; all routes still exist.
- Inbox is no longer an enormous hero page with separated content. Use a quiet Figma-style light utility surface, concise title, search, All/Unread, and real message rows separated by hairline dividers.

## Caveats and signoff

Figma file currently contains no Inbox frame; Inbox uses Figma's utility styling and the founder's messaging reference, NOT pixel-identical Figma Inbox markup.
Figma is a geometry reference, not a data source for people, prices, payment confirmations or work media.
Phone image crop may need a per-media fit preference for certain artworks; do not automatically alter source files.

Release needs actual screenshot review: authenticated staging feed on 320/360/390/430, short-height/landscape, and both Safari and installed iPhone PWA. Cover image/video, one service, one product, multiple offers, modal focus, long captions, keyboard and screen-reader navigation. CI and synthetic browser snapshots prove structural integrity, NOT final Figma acceptance. No deployment or real payments authorized.
