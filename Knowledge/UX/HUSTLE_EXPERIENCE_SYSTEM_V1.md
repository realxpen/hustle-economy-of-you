# Hustle Experience System v1 — Mobile-first UX foundation

Status: Implemented foundation in Phase 20/21 build stream; comprehensive screen-by-screen review deferred to Monday laptop session.
Updated: 2026-10-10
Product: **Hustle — The Economy of You**
Action line: **Find Hustlers. Get It Done.**

## 1. Experience promise

Every meaningful screen should help someone travel through the proven Hustle loop:

**Skill → Demonstration → Discovery → Trust → Opportunity → Transaction → Reputation → Growth**

Hustle is not a generic social feed or generic directory. Skill demonstration is the discovery surface; trust and clear business context enable a booking or purchase. Content must never bury economic action, and commerce must never obscure payment authority.

**Mobile-first** means every important task can be understood and completed on a 360–390px viewport with one hand, without requiring desktop or a different account mode. There is **one identity**; Client, Hustler, Agent are progressive capabilities, not role tabs.

## 2. Brand and interface character

**Vibe:** confident, useful, expressive, editorial, human-scale; modern craft rather than a bank app or entertainment feed. The tone can be playful in discovery and becomes precise and reassuring in payment, permissions and trust.

**Palette:** warm-paper canvas, near-black type and surfaces, Hustle orange for primary action/active attention. Reserve green/red for true success/danger. Don't use orange as a substitute for status meaning. Avoid tinted rainbow cards for every feature.

**Typography:** prefer the product sans stack (Inter → system), bold compact display headings with restrained tight tracking; use serif italics only as deliberate editorial accent in marketing/discovery hero, not in forms, statuses or dense dashboards. Readability takes priority over display effect.

**Imagery:** creator-supplied work and demonstration media carry the interface. No random stock photography. The surrounding UI should be calm enough for photos/video, with consistent object-fit and contextual affordances.

**Tokens live in** `apps/web/app/globals.css`: `--h-ink`, `--h-paper`, `--h-surface`, `--h-orange`, `--h-border`, spacing `--h-space-1…8`, radius `--h-radius-sm…xl`, motion and focus variables. Components should consume semantic tokens instead of hardcoding nearly identical shades.

## 3. Grid, density and rhythm

| Property | Behavior |
|---|---|
| 320–360px | Preserve one-column reading and one-hand actions; reduce label only when necessary |
| 360–760px | Mobile discovery/feed and six-action bottom navigation; cards remain single-column |
| 761–1024px | Tablet flex and two-column economic surfaces when content supports it |
| Above 1024px | Max content width 1240px, whitespace for intentional hierarchy |
| Primary reading width | About 68 characters, avoid ultra-wide instruction paragraphs |
| Spacing | 4px scale; prefer 8/12/16/24/32/48/64px rhythm |
| Tap targets | Aim for at least 44×44px (mobile dock links ≥58px high) |
| Corners | 10/18/26/34px according to visual weight, not random values |
| Body text | Typically 14–16px for dense controls, 16px+ for long copy |
| Contrast | Small text and actionable controls must remain readable on cream surfaces |

Use *one strong primary action per decision area*. Secondary actions should be differentiated without being made visually invisible. Larger headings belong at page/section boundaries, not on every card.

## 4. Information architecture

**Persistent mobile dock (six clear destinations):**

| Label | Destination | Question answered |
|---|---|---|
| Discover | `/home` | Who demonstrates useful skill around me? |
| Search | `/search` | I know what I need; who or what matches? |
| Market | `/marketplace` | What Services/Products can I buy? |
| Inbox | `/messages` | What's happening in my conversations? |
| Activity | `/notifications` | What meaningful change needs attention? |
| You | `/account` | Who am I on Hustle; what can I manage? |

Dock uses route-aware selected state, notification-group badge, 44px+ touch targets, safe-area insets, keyboard focus indication and reduced-motion support. Hide it during immersive Live and active chat detail, while keeping explicit back navigation. Do **not** surface different navigation/account switchers for Hustler vs Client vs Agent.

On desktop, current contextual headers remain operational; consolidating those headers into shared chrome is a separate follow-up to avoid replacing proven routes in one risky change.

## 5. Screen architecture: what belongs above the fold

- **Discovery:** useful Story strip and feed control, author identity/proof, meaningful media, follow/message, attached Service/Product, visible business pathway. Show why surfaced where possible.
- **Search:** task-first input, useful filters, result type context, verified signals only when earned, one clear path to profile or offer.
- **Market:** All / Services / Products mode, legible pricing and availability, attached maker identity, quick path to terms and checkout.
- **Public storefront:** show what the Hustler does, evidence of work, Services/Products, verifiable reviews and contact/book actions; external sharing works without a login wall where read access is public.
- **Messages:** clearly distinguish creator/Client conversation, Agent-assisted attribution, unread state, attachments, connection back to original offer.
- **Activity:** group chat alerts by conversation, but show Booking/Order/application/trust events separately with exact next action; no endless vanity nudges.
- **Bookings & Orders:** show authoritative current status, clear next step, actor and time, safe payments boundary, counterpart identity, no self-declared paid/released labels.
- **Agent workspace:** representation identity visible, permission-scoped actions, full request review before decisive operations, audited attribution, no financial/reputation shortcuts.
- **Wallet:** ledger-backed state with clear Available/Pending/Escrow distinction; money states never implied by cosmetic UI.
- **Account:** one account identity, visible capability progression, trust and shortcuts to provider tools; avoid presenting it as a cluttered multi-role dashboard.

## 6. Core reusable patterns

1. **Page shell:** stable brand and context, consistent max width and mobile safe area.
2. **Page intro:** eyebrow (context) → clear title → one-sentence why/what → primary action.
3. **Business card:** capability, proof/identity, price or status, next action; avoid ambiguous decorative cards.
4. **Status:** text + shape/icon; don't rely on color alone. Define Empty, Loading, Error, Ready, Blocked states in all important workflows.
5. **Forms:** always identify required fields, progressive disclosure, inline errors, clear disable/busy state, full keyboard access.
6. **Destructive/financial actions:** distinct confirmation and provenance; show payment truth only after authoritative API result.
7. **Activity cards:** date, event category, readable summary, obvious linked object. Message grouping is per conversation/recipient and unread badge is group count.

## 7. Accessibility and resilience

- Visible keyboard focus; skip link targets root app content.
- High-contrast small text, labels on interactive controls, `aria-current` for active nav and `aria-label` for icon meaning.
- Don't convey status by color alone; add words/icons.
- Support reduced motion and manual media pause; prevent autoplay surprises in sensitive contexts.
- Support mobile safe-area bottom inset; don't cover chat composer or Live actions with the dock.
- Error screens say what happened and what action is possible, without leaking hidden business details.
- Notifications and financial state still operate when unread count fetch fails: noncritical chrome never blocks sign-in or browsing.

## 8. Build sequence: experience before polish

1. **UX foundation** — tokens + responsive mobile dock + focus/reduced-motion/skip navigation, ship in feature PR.
2. **Phase 20C** — finish meaningful event notifications (applications, social follow/comments, Live) with idempotence and privacy.
3. **Phase 21** — aggregate meaningful conversion funnel and provider time-to-first-opportunity/marketplace metrics from authoritative actions.
4. **Screen harmonization** — discovery, search, marketplace, Activity and account: consistently apply tokens, actions, states and page layouts.
5. **Monday laptop acceptance** — consolidated critical-path tests, mobile/desktop visual QA, accessibility keyboard pass, then owner-authorized staging/production deployments.

## 9. Monday review protocol

Use one deliberately designed scenario across multiple capabilities:

Discover content → inspect profile/proof → open referenced offer → message → Booking or Cart/Order → payment **in isolated sandbox only** → completion → verified review → check activity and Analytics.

Also review permissions (Client, Hustler, Agent, Admin), responsive screen hierarchy on 360px/390px/768px/1280px, live/media permission states, empty/error/loading views and touch targets. No live money/escrow/payout manual testing without separate owner approval.

**Current acceptance:** design-token/nav implementation and CI are build evidence. Monday owner-facing UI/runtime acceptance is intentionally deferred. No claim that the entire MVP has passed pilot activation yet.

## 10. UX-004 harmonization (candidate; October 10)
Messaging, Activity, Wallet, Live, content authoring and Agent workspace now extend the same mobile-first interaction, error-state and permission/financial-status language. See ADR-0057 and UX-004 QA acceptance for exact code boundaries and pending Monday visual/runtime evidence. Live remains intentionally immersive rather than forced into an ordinary card dashboard. Client filters on already-loaded messages/notifications must never be misrepresented as server-wide search or historical backfill. No role switcher or frontend financial authority was added.
