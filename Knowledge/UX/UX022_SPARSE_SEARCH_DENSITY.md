# UX022 — Sparse iPhone Search density

## Founder device observation (2026-10-29)
UX021's People, Posts and Services presentation works with real `xpen` results. The screenshots show one published Post occupying only the first half of a 2-column gallery while the second half remains empty. A redundant bottom padding reserve also lengthens the final-result scroll.

## Decision
Retain the UX019 Explore shell and UX021 identity/media/commerce cards. For only **one** post in a rendered group, switch to a full-width mobile media feature with a 16:10 image area. Keep the existing two-column visual grid when two or more posts exist. Desktop grids are untouched. Use no filler items, duplicate records, fake thumbnails, or placeholder "recommended" content.

Trim only the extra search-results bottom padding. The root app shell continues to reserve the fixed navigation safe area.

## Regression
The isolated local browser journey checks the real-shaped single post fills at least 94% of the result group at 320/390 CSS px, and the search result wrapper does not double-reserve navigation. Other UX020/UX021 result URLs, tabs, filters, prices, rankings and publication checks remain as before. No schema, payment, auth, staging or production deployment changes.
