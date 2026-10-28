# UX021 — Discovery-first search results

Founder iPhone acceptance of UX020 confirmed a real People + Service + Post response for the handle `xpen`. Founder supplied TikTok and X search screenshots as references for a denser, media-led presentation.

## Decision
Preserve the approved UX019 Explore search field, suggestions, skills, filter control and navigation. Change **only search results presentation**. Top results group by type into compact People rows, visual Posts, price-led Services and Products. Keep existing People/Posts/Services/Products tabs.

## Implementation boundaries
- Retain the API's actual results, published-content protections, ranking and cursor/limit. No mock content, fake counts, invented ratings, fake Follow or Buy actions.
- Remove internal numeric relevance scores from user-facing search cards; preserve relevance and original result positions for telemetry.
- Keep canonical links (profile, post, service, product). `See all` switches to the same existing category search endpoint.
- Posts show actual photo media or a nonplaying video preview with a play marker. Without media, use a branded empty-media state rather than fabricated photos.
- Service and Product prices use existing currency formatters.
- Changes are search-only. Marketplace display and payments/booking/auth are not altered.

## Acceptance
Check `xpen` in iPhone isolated PWA: profile row, published post media/caption and service price. Switch type using See all. Check `Hello`, each tab, a product-owning test account, empty result, pagination, small-screen clipping and keyboard navigation. Automated source contract plus web typecheck/CI must pass before release; real device acceptance remains separate.
