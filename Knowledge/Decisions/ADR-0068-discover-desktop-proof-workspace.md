# ADR-0068 — Desktop Discover proof + context workspace

Date: 2026-10-12
Status: PR #103 merged d51cda8; owner Web production deployed; authenticated desktop screenshot reviewed; device acceptance remains pending
Scope: Web Discover presentation only (`/home`). No API, database, ranking, payments, agent authority, role model or content data changes.

## Trigger
On the newly owner-deployed Glass Experience at `8332fd0`, desktop Discover still showed a narrow 490px feed inside a 680px layout, leaving most of a 1440px+ window unused. Owner requested an actual fix, not just an observation.

## Decision
- Keep **one immersive post at a time**, snap/scroll behavior, real media, single set of Like/Comment/Save/Share controls, truthful creator status and existing offer Quick Views.
- On wide **landscape-style desktop windows (at least 1120px wide and 650px high)**, create a centered **990px proof-first workspace**: primary media on the left, existing post action rail directly alongside it, and a **secondary frosted context panel** showing the same real post's creator, caption, tags, attached services/products and error feedback. This is a rearrangement of the existing post body, not a repeated sidebar, promotional widget, new API or extra click to see offers.
- Use the *same* post body node as a sibling of the media canvas; do not duplicate the author, offer controls or business facts between side panel and overlay. Original feed tracking and actions remain attached to the real post.
- For 761–1119px windows, mildly widen the original single-stage portrait composition and retain the external action rail; preserve footer alignment even though its DOM parent changes.
- For phones and short windows, keep the previous full-bleed and compact action / measured footer experience intact. No forcing desktop layout on mobile or zoomed browsers.
- Respect appearance colors, focus, reduced-transparency preference and authentic content over decorative blur. Existing media is not blurred; only media backdrops and chrome use blur under previous rules.

## Compatibility / non-goals
Do not add a second Discover navigation or Search shortcut, do not turn Discover into a multi-card grid, do not crop user media and do not infer verification, offers or metrics.

This consciously refines ADR-0059's desktop composition after new owner evidence while preserving its post-first and single-action-set intent. ADR-0067's shared glass system remains the source for panel tokens.

## Validation and release gate
- Source/CI checks must verify the media/detail sibling structure, bounded responsive breakpoint, unchanged quick views, no duplicate offer nodes and the accessibility fallback.
- Local public-shell responsive smoke and full workspace builds must pass; this alone does not prove an authenticated feed layout.
- Owner-controlled deployment, then desktop signed-in visual QA at 1120×700, 1440×900 and wider, tablet at 768/1024, and iPhone normal/enlarged text with working actions and offers.
- **Do not autonomously release.** Physical-device, payment-sandbox and permission acceptance remain separate.

## Desktop contextual density refinement — 2026-10-12
Owner's new desktop production screenshot confirmed the widened workspace but exposed a large empty vertical gap: the caption/tags were at the top, while the closed `2 attached offers` dock was anchored to the bottom. The panel hid the most relevant economic context despite ample space.

Decision: for the existing wide-desktop breakpoint only, put attached offers immediately after caption/tags with a separating rule and auto-expand the **real** services/products on initial render. Users can collapse/reopen them using the existing accessible toggle. When crossing the wide-desktop breakpoint, return to a collapsed compact/mobile offer sheet so the immersive work remains unobstructed. All expanded offer cards and their prices remain API-backed with the same OfferQuickView; no new data and no invented promotions. Let the context panel itself scroll naturally for long captions or many actual offers, with no nested offer-list scroller. Use adaptive glass ink/outline tokens and at least 44px offer quick-view targets.

Evidence remains GitHub CI + owner-supplied screenshot. This refinement does **not** imply iPhone/desktop interactive acceptance or authorize production deployment.
