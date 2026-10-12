# ADR-0067 — Frictionless navigation and shared glass visual system

Status: PR #101 merged; final Foundation CI 38252018659 successful; manual deployment and signed-in physical-device acceptance pending
Date: 2026-10-12
Scope: Hustle Next.js Web styles, shared header, Discover navigation, tests and docs. No API, DB, identity, Agent permissions, payment status or deployment changes.

## Context
Owner observed Search repeated in the six-route bottom dock and in Discover's top-right quick actions. This is redundant global navigation and competes with creating content. Prior UX iterations have glass in the dock, but other screens inconsistently use flat, thick cards and mismatched dark/light framing, making the app feel disconnected.

## Decision
Use **one primary global Search destination**: in mobile bottom dock and desktop shared primary navigation. Remove extra Search in Discover quick actions while retaining a Stories shortcut and directing '+' straight to the actual Post composer. Avoid adding role switchers, mock service/prices, floating modal search, fake instant checkout or new API requests merely to reduce clicks. Hide root-level mobile header breadcrumbs that repeat the active dock/page title; retain real contextual breadcrumbs and secondary navigation.

Introduce `apps/web/app/glass-system.css` as the global token layer, imported after the adaptive foundation. It defines legible translucent neutral backgrounds, outlines, restrained saturating backdrop blur, and dark adaptive overrides, with reduced-transparency fallbacks. Spread **scoped** styles through existing CSS modules instead of blanket `article`/media selectors, covering core user routes, You, storefront, professional management, posting, Story/Live, booking/cart/checkout, messaging, trust/consent and Agent. Actual creator photos/video remain sharp; financial statuses, safety indications, user consent, input controls and captions retain opaque readability and API authority.

## Release boundaries
This is a broad visual change and requires Foundation CI + local Chromium read-only smoke, then owner-controlled Web deployment and real signed-in Safari/Android/desktop QA at normal/enlarged text and high contrast. Only source-level/static smoke is possible before deployment; do not claim all pages physically verified. Real role/payment/Story/Live tests remain separate. No automatic production deployment or user actions.
