# UX020 — Search across creator posts, services and products

Founder feedback: Search shows a creator profile but not the creator's related published work.

## Verified source-level root cause
- Top already calls the People, Posts, Services and Products rankers. The existing result card already renders each kind.
- Posts index owner username, but Services and Products did not. A creator-handle query matched the person but could omit their published offers.
- Published Posts were additionally filtered by active Hustler capability and a published professional profile. The Feed and public post route do not enforce that restriction, so publicly visible client posts (such as a caption containing Hello) could disappear from Search.
- Typeahead requested only 6 globally ranked hits, often hiding lower-ranked kinds.

## Implemented
- Added a weighted owner username field to published Services and Products search ranking, retaining all other matching and filters.
- Raised Top autocomplete candidate count to 24 and preview at most 2 results per kind, 8 total. Backend still determines real published candidates; no fake results.
- Search now finds PUBLISHED, moderation-CLEAR Posts without requiring Hustler activation. It searches public post content and identity while suppressing any still-draft professional skills, categories, summaries or headline.
- Added fake-Prisma backend runtime tests for all four result types, creator-handle matches, published client posts, canonical URLs, caption/title matching, and privacy-preserving publication gates.

## Staging and production guardrails
- Draft posts, unpublished Services/Products, moderation-held Posts and unpublished professional details must remain excluded; no invented posts, products or creators.
- Search still has a bounded recent candidate scan (current take 220), so very old records may need a separately designed indexing enhancement.
- This backend change must be released through the isolated AWS Lambda Staging API workflow. A Cloudflare PWA update alone is insufficient.
- CI mocks do not establish that all four records actually exist for a given live creator. Test with a staging account owning published items after isolated API deployment.
- No production release, payments, migration, schema, auth or data mutation changes.
