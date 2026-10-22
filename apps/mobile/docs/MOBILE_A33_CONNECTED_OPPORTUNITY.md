# Hustle Mobile A3.3 — Connected proof-to-opportunity preview

**Date:** 2026-10-22  
**Runtime acceptance: PENDING.** No signed-in staging account or physical Android build has been tested. **No Expo APK** was built, and owner-approved A1 offline rollback remains intact.

## Problem and scope

PR #172 connected Top/People/Posts/Services/Products tabs, truthful records and server-owned cursors. Their results still launched a public web page only when a host was configured, leaving no in-app bridge from demonstrated capability to the Hustler who offers it. This slice implements **search result → Hustler preview → matched published service/product → local enquiry preview** using only published API fields already returned by `SearchService`.

The accepted `ADR-0008` and `ADR-0062` govern canonical ownership, published eligibility and navigation. This is an in-app read-only preview, *not* a separate provider record, searchable catalogue or booking flow.

## Experience specification

1. Tap any published result (person, post, service or product). A mobile-friendly, keyboard-safe modal opens to the source-backed **Hustler profile**. Name, handle, skill, headline, location, optional bio/summary and explicit contact-verification status come only from the search API.
2. For a post, its caption is labelled as *the work that brought you here*. This never asserts that the post is attached to any particular product or service.
3. Show **Published offers in these search results** by matching returned `owner.id` to the selected Hustler's canonical `User.id`. Dedupe by `kind:id`. Include the selected service/product if it is the source; never match merely by names or category. This is an incomplete search-result slice, never the Hustler's full inventory. If none matched, state the limitation.
4. Tap a matched published service or product for the original backend title, owner, price (or Price on request) and description. Clearly note availability or stock is not confirmed by the search response.
5. **Service only:** Prepare a booking enquiry. The user can type up to 1,200 characters and review that local text, with unmistakable **"Enquiry prepared — not sent"** feedback. No HTTP requests, server draft, booking creation, calendar reservation, provider message, share, checkout, payment or escrow is triggered.
6. Product page remains view-only; checkout and variants stay disabled. An optional public profile/offer link is available **only** when the configured web host and canonical path validation succeed. Otherwise the app explains it is unavailable.
7. Dismiss and Android Back clear the local enquiry and snapshot. Previously loaded search tab, query, cursor and results remain intact for the user.

## Architecture

- `apps/mobile/src/experience/feed-api.ts`: exposes already public owner and person fields in the mobile SearchResult read-only type (no API route, backend schema or database change).
- `src/ux004/discovery/connectedOpportunity.ts`: pure identity, same-owner matched offers, current offer and canonical owner link helpers.
- `MobileExperience.tsx`: separate opportunity modal so existing Feed creator/service/booking sheets and their feature gate are untouched. Source results and matched offers are captured at tap time, making the view stable if a query changes later.
- Existing `connectedSearchWebLink` and configured `EXPO_PUBLIC_PUBLIC_WEB_URL` still govern external navigation.
- No new dependencies, permissions, API writes, events, real-time communication or production setup.

## Engineering acceptance

A new Node contract transpiles and executes the actual helper, using synthetic API-shaped records with duplicate IDs, same display names but different canonical owners, absent owner IDs, people, posts and both offer kinds. It checks for safe profile-link construction and actual source no-write boundaries. The existing A3.1/A3.2 checks are updated only to expect the new in-app review action; all existing offline A1/A2 checks remain.

The contract is wired through `apps/mobile/scripts/mobile-experience-contract.mjs`, which is invoked by the existing Mobile Cloud CI and owner-gated manual EAS preflight. No root or web files changed.

## Deferred signed-in/device QA — not run

| Journey | Expected |
|---|---|
| Search actual published person and open preview | Correct name, skill and public summary, no fabricated offers |
| Open published post | Correct creator and caption, without inventing post/offer attachment |
| Search real service; tap result → Hustler → offer | The same canonical service and owner ID, as returned by API |
| Two Hustlers share a display name | Only the same canonical `owner.id` appears in matched offers |
| Product result → profile → product | Accurate product description, with checkout unavailable |
| Service result → profile → offer → enquiry preview | User types request, reviews it, and sees *not sent*; no API mutation |
| Missing web origin / malicious username | No public profile/offer redirect |
| Later search query changes in background | Open preview maintains the original selected identity and offer |
| Phone 320dp, font scaling, TalkBack and Android Back | Modal controls reachable, readable, dismiss without lost search state |
| No backend / unauthenticated | No fake data, booking, chat, payments or escrow |

The owner must record exact CI commit, valid nonproduction API/auth scope, phone/Waydroid build and device details, actual passed/failed scenarios, and sign-off. Cloud source/TypeScript/Metro/Gradle tests are **not** signed-in or physical device acceptance.

## Gate

Owner review and manual merge only once exact-head Mobile CI, Foundation CI and free Android native Gradle are green. Vercel project's independent quota failures do not authorize new deployment, billing or account changes.
