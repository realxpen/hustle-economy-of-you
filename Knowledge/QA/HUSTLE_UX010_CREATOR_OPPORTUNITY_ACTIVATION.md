# UX010 — Creator to Opportunity activation (nonfinancial pilot slice)

Status: Proposed code only; NOT deployed or accepted on iPhone.

## Rationale
UX009 AWS-backed regular staging acceptance is complete (issue #230). The next MVP risk is economic discovery, not another staging migration.

Canonical loop: Capability → Post/Proof → Discovery → Professional identity → Published offer → Booking → Trust.

ADR-0027 supersedes the old Hustler-only posting gate: any signed-in User (including a Client) can author social Posts and link existing published offers. HUSTLER is still additive permission for professional storefronts and selling Services/Products; no mode switch.

## Integrated implementation
- Authenticated read-only GET /api/v1/creator-activation, derived from the signed-in identity's own User/Profile/Post/Service/Product/Booking rows.
- Real published/draft Post counts, counts of Posts referencing currently published offers, published own Services/Products for active Hustlers, and completed bookings as Hustler. Only recent owner Post IDs/status/captions; no financial data or unrelated account rows.
- Adaptive /grow iPhone/desktop workspace links actual Post create/manage/public routes, optional Hustler application, professional storefront, Services and home feed.
- Existing You account studio links to Your creator progress. Explain author's own Posts may be excluded from their For You feed; staging currently requires external HTTPS media URLs.
- Exact isolated Cloudflare GET proxy and Nest staging GET request policy allow only creator-activation; AuthGuard mandatory. No write route, migration, payment operation or new runtime resource.
- Foundation CI executes compiled Nest service with mock Prisma fixtures for separate Client and Hustler identities, unknown-session denial and read-only invariants.

## Release/acceptance gates
1. PR Foundation CI and Cloudflare compatibility green, reviewed.
2. Founder reviews merge. To activate on AWS-backed regular staging, explicitly deploy the updated Nest API to the isolated AWS Lambda through its protected pipeline AND separately deploy the Cloudflare regular staging Worker through manual AWS cutover. A Worker-only deployment cannot add the new API endpoint.
3. Client signs in to /grow and sees only their own published/draft Posts, and may create Client social Posts.
4. Hustler sees real published storefront, published Service/Product count, completed Booking outcome and links to edit/public screens.
5. Second account checks public Post/offer after consented publication. No payments, live providers or replays of completed bookings.

## Limitations
No direct iPhone photo/video upload yet; media still requires a public HTTPS URL. The read model is a progress guide and does not itself prove feed impression/delivery or verified conversion. Code/CI success is not live device acceptance. PR must not auto-deploy or write staging data.
