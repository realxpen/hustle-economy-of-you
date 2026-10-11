# ADR-0059 — Immersive post-first Discovery

Status: PR #88 merged; Foundation CI run 38088362956 passed; browser/runtime acceptance pending
Date: 2026-10-10
Scope: Web /home only, Discovery presentation + browser media behavior. No server, database, money, roles, trust or commerce schema changes.

## Trigger
Owner reviewed the actual deployed Discover screenshots and corrected the earlier interpretation of "content-first": the screen must feel like TikTok, with each POST occupying attention, instead of a large hero above a familiar set of feed cards. The owner reference imagery also calls for floating compact orange-accented controls and an intentional portrait viewer on large screens. Merely adjusting desktop font sizes or recoloring cards is insufficient.

## Decision
- Remove the Discover hero/marketing card. The first viewport should show a published post after a small authentic navigation/control strip.
- One real Post at a time, tall immersive canvas, vertical scroll snap in a bounded feed; each additional post snaps into focus; retain supported For You / Nearby / Connections API tabs and link to existing /live.
- Floating icon rail for server-backed like, comments, save, and share; creator profile, verified status only when verified by source, follow/unfollow, caption, tags and location overlay on media. No fabricated social proof or sample cards.
- Image compositions retain their original visible content via contain + dimmed ambient backdrop; horizontal media carousels remain independently swipeable.
- If a native video leads a Post, autoplay it *muted* when >=55% visible, pause when hidden/unmounted, and disable automatic playback under reduced-motion preference. Native controls allow user unmute/pause; external YouTube iframe media stays user-controlled. Do not autoplay audio. Content impressions/watch events must still derive from actual card visibility.
- Services/Products are never silently removed from Posts. Show a compact "View attached offer(s)" toggle, then the unchanged canonical OfferQuickView flow and original feed.service_clicked/product_clicked instrumentation; only real API-backed offer prices.
- Preserve user-authoritative follow/like/save controls and failed-write rollback. No roles switched and no financial authority implied by UI.
- Existing feed cursor API remains authoritative. Auto-page at end via IntersectionObserver plus explicit retry button, with in-flight guard, duplicate IDs suppressed and stale-tab results rejected.
- Desktop gets a portrait-stage with adjacent search/stories/marketplace links; mobile minimizes noncontent chrome and preserves the existing six-route floating dock. Use responsive focus, text labels, accessible buttons, reduced-motion snapping and sensible fallback for empty/no-media/error posts.

## Non-goals
- Native TikTok SDK, vendor audio/music licensing, live payment, automatic commerce transactions, inferred analytics.
- Using Pinterest assets or copying third-party branding.
- Rewriting Feed API ranking or changing verified-review/payment authority.

## QA and release
See Knowledge/QA/DISCOVER_IMMERSIVE_FEED_ACCEPTANCE.md. Until device/browser testing, GitHub build success proves compile/build only. Owner controls GitHub Actions production deployment separately; no automatic release.


## 2026-10-11 composition refinement
The first viewport hotfix demonstrated that making the stage smaller does not itself make posts primary. With a 342px wide media area, allocating ~73px right padding *inside* the post left overlays unreadably narrow. Desktop design therefore places the floating interaction rail **outside** the post canvas, retains captions/creator and a single-line offer chip on the content stage, and centers the viewer without the sidebar competing for attention. Mobile remains full-bleed with the rail overlay in an intentionally separated vertical zone; check crowded posts at real viewport sizes. The entry points for Stories, Search, Create, Live, Marketplace, and the canonical attached offers remain available.

Implementation status: the composition refinement merged as PR #90, CI run 38118370353 passed; no claims of real-device visual approval or owner-authorized release.
