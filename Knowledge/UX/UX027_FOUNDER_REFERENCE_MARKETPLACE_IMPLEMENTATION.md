# UX027 — Founder-selected marketplace visual implementation

## Design basis
On October 29, 2026 the founder provided a **four-screen mobile reference image** and instructed that the **actual Hustle frontend should look like that image**, rather than generating the illustration again. This change implements the visual arrangement while retaining the live product and booking systems.

## Four-screen translation
1. **Everything**: brand and account access, search, three browsing modes, dynamic illustrated category shortcuts from published offers, editorial featured banner using the first *real* published Service photo where available, Featured Services and Featured Products as separate grids. An honest empty state remains for missing Products.
2. **Services & Skills**: focused two-column service photo cards with provider identity, title, actual formatted price and canonical Service link. No invented review stars.
3. **Products**: two-column catalog cards with actual Product photo, product name, seller and price; canonical Product detail handles existing checkout.
4. **Service Detail**: selected published work image/video with gallery thumbnails, offer title and actual price, real provider and trust info, anchor navigation into overview/details/reviews only when reviews exist, and mobile sticky *Book now* that preserves authenticated Booking, consultation context and staging safety.

## Design fidelity and deliberate omissions
- Warm paper #F7F6F2, deep forest #18281E, lime #C9F26B, soft green cards, compact 2-column gallery, typography and lightweight shapes align with the chosen image.
- The reference contains demo people, foreign USD amounts, 4.8/5-star ratings, Follow hearts and shopping-cart buttons. **Do not copy any of those as fake Hustle data or inert controls**. All published users/media/prices come from existing API. A product not yet published is not fabricated just to fill the mockup.
- Existing Search, messaging, booking, consent, escrow and payment boundaries are preserved; no new backend/schema/migrations or production deployments.

## QA/release
- UX027 source and Chromium computed-style/grid checks run in Foundation CI, alongside UX024/UX025, authentication and financial contracts.
- Manual iPhone review of the full UX after branch merge and *separately approved* isolated Cloudflare preview deploy is required before design acceptance.
