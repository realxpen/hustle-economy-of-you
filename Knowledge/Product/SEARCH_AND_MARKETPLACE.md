# Search + Marketplace

## Purpose

Phase 9 adds intentional discovery to Hustle.

The Home feed answers:

> Show me useful people and things I may not already know.

Search answers:

> I need something specific.

Examples:
- `photographer in Lagos`
- `full stack developer`
- `barber near me`
- `black creator t-shirt`

Hustle Search and Marketplace must connect intent to the same canonical people, Posts, Services and Products already created by the ecosystem.

Core loop:

`Intent → Search/Browse → Evidence → Identity → Offer → Opportunity`

Search must not become a duplicate marketplace database or a detached AI chatbot.

## Source-defined MVP surfaces

### Search tabs

For MVP:
- **Top**
- **People**
- **Posts**
- **Services**
- **Products**

Later ecosystem surfaces:
- Live
- Stories
- Training
- Requests
- Map

Do not invent empty tabs for later phases.

### Marketplace

Marketplace is the browse-first commercial surface.

For the current MVP foundation it contains:
- **All**
- **Services**
- **Products**

Training/Apprenticeship remains a later capability and must not be faked in Phase 9.

Search and Marketplace are related but not identical:
- Search begins with explicit user intent.
- Marketplace allows category/filter-led browsing of current economic offers.

## Searchable intent

The source states that users should be able to search by:
- skill
- service
- professional name
- business name where available
- category
- location
- keywords

Current canonical fields support intent matching across:

### People
- display name
- username
- bio
- location
- professional headline
- primary skill
- secondary skills
- professional category
- professional summary

### Posts
- caption
- category
- location
- tags
- creator identity / professional skill context

### Services
- title
- category
- description
- location
- availability note
- delivery mode
- requirements
- owner identity / skill context

### Products
- title
- category
- description
- product type
- delivery information
- owner identity / skill context

## Eligibility

Search only returns records that are currently publicly eligible.

### People
A Person result requires:
- `ProfessionalProfile = PUBLISHED`
- `HUSTLER = ACTIVE`

### Posts
A Post result requires:
- `Post = PUBLISHED`
- owning ProfessionalProfile PUBLISHED
- creator HUSTLER ACTIVE

### Services
A Service result requires:
- `Service = PUBLISHED`
- owning ProfessionalProfile PUBLISHED
- owner HUSTLER ACTIVE

### Products
A Product result requires:
- `Product = PUBLISHED`
- owning ProfessionalProfile PUBLISHED
- owner HUSTLER ACTIVE

Private applicant data, email, phone, reviewer data and verification documents must never enter public Search results.

## Filters

The source defines these filters:
- category
- skill
- location
- nearby
- price
- rating
- verified
- availability

Phase 9 must only expose filters backed by authoritative data.

### Supported now
- category
- skill
- location
- nearby using normalized textual location matching
- minimum/maximum price for Services/Products
- verified identity
- Service delivery mode
- Product type

### Availability boundary
Current Service records include an availability note, not a canonical booking calendar. Phase 9 may distinguish Services that contain availability information, but it must not pretend to know real-time bookable slots before Phase 11.

### Rating boundary
Ratings/reviews become authoritative in Phase 14. Do not fabricate a rating filter before that data exists. The UI may preserve the future filter concept in knowledge/design, but the running MVP must not present fake rating values.

## Search architecture

Search results remain projections over canonical records.

Current MVP architecture:

`Query`
`↓`
`Normalize intent/tokens`
`↓`
`Query canonical PostgreSQL records`
`↓`
`Eligibility filters`
`↓`
`Deterministic lexical + structured scoring`
`↓`
`Type-specific results`
`↓`
`Top merge`

No separate source-of-truth search entity is created.

A specialized search index, semantic retrieval or AI query-understanding layer may be added later without changing canonical ownership.

## MVP ranking

Ranking must begin deterministic and inspectable, consistent with Phase 8.

Useful signals include:
- exact username/title/name match
- exact phrase match
- prefix match
- token match
- skill/category match
- location match
- verified identity
- recency where relevant
- modest engagement evidence for Posts
- economic usefulness/current publication state

Raw popularity must not dominate.

Top results should normalize type-specific scores so one result type does not win simply because it has more searchable text fields.

The implementation should return ranking reasons during development where useful for debugging and evaluation.

## Query behavior

Normalize:
- whitespace
- casing
- punctuation where safe

Preserve meaningful user intent such as location and skill phrases.

MVP should support multi-token queries such as:
- `photographer lagos`
- `full stack developer`
- `fashion black shirt`

A zero-result query must produce a useful empty state rather than silently substituting unrelated results.

## Pagination

Every result tab must support bounded pagination.

Use deterministic cursor pagination with a stable tie-breaker such as:

`score → relevant timestamp → ID`

Do not load the entire marketplace into the client.

## Search API contract

Planned MVP endpoints:

- `GET /api/v1/search`
- `GET /api/v1/search/top`
- `GET /api/v1/search/people`
- `GET /api/v1/search/posts`
- `GET /api/v1/search/services`
- `GET /api/v1/search/products`

Common query parameters may include:
- `q`
- `cursor`
- `limit`
- `category`
- `skill`
- `location`
- `nearby`
- `minPrice`
- `maxPrice`
- `verified`
- type-specific supported filters

Marketplace endpoints may reuse the same search assembler with browse-mode semantics rather than create a second ranking system.

## Marketplace API contract

Planned MVP:
- `GET /api/v1/marketplace`
- `GET /api/v1/marketplace/services`
- `GET /api/v1/marketplace/products`

Marketplace must work without a text query and prioritize useful current offers using category/location/recency/quality signals.

## Instrumentation

Search success is an important marketplace health signal.

Initial event vocabulary:
- `search.performed`
- `search.zero_results`
- `search.result_clicked`
- `marketplace.viewed`
- `marketplace.result_clicked`

Useful payload context:
- viewer User ID
- normalized query
- active tab
- filters
- result count
- clicked result type/ID
- result position
- search/session ID

Instrumentation observes behavior and never changes authorization or canonical result state.

## Search quality gate

Phase 9 must prove intentional discovery, not merely endpoint existence.

A synchronized Client should be able to:

`enter a real need → receive relevant eligible results → distinguish People/Posts/Services/Products → apply supported filters → open the professional or offer → produce measurable search events`

Example gate using current seeded data:

`full stack developer Lagos`
`↓`
`xpen / Full-Stack content / Full-Stack Web Application Development`

A Product query such as `creator t-shirt` should surface the published Hustle Creator T-Shirt without exposing private owner data.

## Phase boundaries

Phase 9 owns:
- universal search
- Top/People/Posts/Services/Products result tabs
- category/filter-led Marketplace browsing
- deterministic search relevance
- cursor pagination
- search/marketplace instrumentation

Phase 10 owns Messaging.
Phase 11 owns real booking availability and booking actions.
Phase 14 owns authoritative ratings/reviews/trust scoring.
Later phases own Stories, Live, Training, Requests and Map result tabs.
Phase 28 Intelligence may later add semantic retrieval, learned ranking and AI intent understanding after real evidence exists.

## Product principle

Search should help a person answer:

> Who or what can genuinely help me with this need?

It should optimize for useful discovery and evidence, not keyword spam or vanity popularity.