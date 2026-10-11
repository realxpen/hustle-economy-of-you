# ADR-0061 — Compact-by-default mobile Discovery presentation

Status: Implemented in feature branch, CI and real iPhone acceptance pending
Date: 2026-10-11
Scope: Next.js Web display density; no API, payment, role, auth, Agent or content contract changes.

## Context
The owner shared two Safari iPhone screenshots: the first, at manually reduced website text/zoom, made Hustle's visual hierarchy feel more content-first; the second, at normal website text, had larger chrome, heading, captions and floating controls. The owner wants the first's **compact look to load automatically for everyone, including on first visit**, without visiting Safari text-size settings.

## Decision
Ship a compact mobile visual density as the **default CSS**. Reduce nonessential chrome proportions (shared header and six-route dock), Discover tab/header footprint, overlay typographic size, icon spacing and offer CTA footprint. Let the actual posted work/media own the remaining viewport. No client hydration, localStorage or server account setting is required to see this baseline.

Do **not** programmatically set website/device zoom to 50% or disable pinch/browser text scaling. Safari controls its own zoom and preferences, and zoom of the actual viewport can fundamentally change CSS breakpoints. Compact styling is a design treatment, *not* a claim that the browser zoom is 50%. Preserve affordances for larger text, suitable target sizes and the previously implemented measured-space Actions fallback.

## Acceptance
Web build and static responsive contract are automated. Visually compare on a new Safari private tab at normal zoom, at larger text, light/dark, with real content and offers. Validate no horizontal overflow or nav/offer overlap; native Mobile/Expo separate. Manual Web release remains owner-controlled.
