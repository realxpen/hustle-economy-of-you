# ADR-0056 — UX-003: Interaction quality, meaningful states and mobile task completion

**Date:** 2026-10-10
**Status:** Built on feature branch; automated CI and Monday owner acceptance pending.
**Product:** Hustle — The Economy of You.

## Problem

UX-002 brought the main marketplace pages under a shared visual hierarchy. Real tasks still varied in how they showed loading, missing data, failed requests, form validation and mobile interactions. A fast Search/Marketplace tab switch could also render stale results from an older, slower API response. Several booking/checkout views still exposed old internal "Phase 12/13" language.

## Decision

1. Introduce a reusable and responsive `ExperienceState` with three explicit variants: **loading**, **empty**, **error**. It includes clear title, optional explanation, optional live action button/link, semantic `role=status/alert`, `aria-busy`, accessible feedback, CSS-based lightweight skeleton and reduced-motion fallback. Do not fabricate content or freeze a screen while a noncritical observation call fails.
2. Adopt it in **Discover, Search, Marketplace, Booking manager, Order manager, Messages, Activity, public Hustler Storefront and Service/Product details**. Empty states explain what appears here and the next useful step; failed fetches allow retry; load-more failures on Booking lists no longer become unhandled promises.
3. Search/Marketplace request version guards ensure results of outdated requests cannot overwrite the latest primary tab/filter request. Preserve the original server queries, result URLs, pagination contract and consent-aware observation reporting. Clearing filters now **re-runs discovery** with the explicitly reset fields. Make query inputs search-friendly and add explicit filter labels, 44px+ controls, horizontally scrollable mode tabs and a single-column fallback for very narrow phones.
4. Booking request form: visible required-field instructions, live description character count, end-after-start validation, accessible error feedback, duplicate-submit guard, clear waiting state. Preserve the original schedule check, direct conversation creation and authoritative Booking API. Describe real payment authority: requesting work is not a charge, paid work requires provider-confirmed funding.
5. Checkout: loading/failed/empty preview states with retry, actual unpaid Order wording, guard against submitting with no valid preview or while busy, proper input autocomplete for delivery, mobile-readable layout and action targets. Preserve the existing checkout endpoint and payment boundary; the UI cannot mark payment confirmed.
6. Keep accessibility semantics visible: clear focus, reduced motion, readable status text, responsive input sizing. New surfaces use UX-001/002 colors, typography and spacing.

## Non-goals / invariants

- This is a **Web-only presentation/async interaction PR**. No changes to Booking/Order/payment services, schema, financial state, role permissions, wallets, escrow or notification event producers.
- No production release or owner manual testing this weekend. Monday's consolidated phone/tablet/desktop and user-journey review remains mandatory.
- We do not add fake/automatic financial transitions, new user roles, external push or AI claims.
- There are remaining legacy screens beyond these core journeys; UX-003 does not claim universal screen-by-screen polish.

## Automated checks and owner acceptance

- Foundation CI must complete Web/Admin/Mobile/API typechecks and builds on **final** PR SHA before merge.
- Isolated paid-Order sandbox normally remains unchanged, and need not be triggered by a Web-only PR. Do not claim it ran if not triggered.
- Monday: verify 320/360/390/768/1280 mobile/tablet/desktop widths; trigger empty, error, retry, slow loading and fast tab-switch conditions; confirm correct Booking/Checkout submit state; validate phone autofill, keyboard focus and no covered bottom actions.
- Owner authorizes Web deployment separately; CI pass alone is **not** visual/runtime acceptance.
