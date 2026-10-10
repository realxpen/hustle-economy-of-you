# ADR-0058 — Adaptive Expressive visual redesign, initial Web implementation

Status: Accepted for code implementation; visual/runtime acceptance pending
Date: 2026-10-10
Scope: Web UI (Discovery, public Hustler Storefront and Inbox, shared chrome); no API or database changes.

## Context
The owner explicitly rejected continued polishing of the previous UI and supplied a Pinterest reference collection plus two selected screenshots. Direction: marry tactile pale/silver layouts and floating geometric icon controls with rich content-first dark screens; orange, not pink, is the dark-theme active/highlight color. The references guide visual character, not real product data or claims.

## Decision
- Build a single Adaptive Expressive system with three appearance choices: System (follows OS changes), Light, Dark.
- Store the optional appearance preference locally. The shared theme control uses semantic labels and a native select.
- Rollout begins on three real-data Web journeys: /home, /u/:username, /messages. Use opt-in main.h-adaptive semantic tokens so unreworked financial, Admin, auth and Agent screens do not receive accidental low-contrast dark styling.
- Shared navigation uses a floating translucent dock while keeping all six canonical routes, route-active icons, unread-group count, keyboard focus, reduced-motion behavior and mobile safe areas. Create/Manage Posts remains a real route, not a fake tab.
- Search shortcuts use the existing /search?q=... supported URL path; original feed rankings, events, follow/like/save, canonical offer references, verified reviews, storefront booking and message paths remain in place.
- Use the existing production media and truthful API state; no externally sourced Pinterest assets, stock identities, manufactured ratings, balances, unread states or inferred authorization.
- Preserve sensitive finance/permission boundaries untouched. Don't deploy, migrate, simulate a successful payment or enable auto-deploy.

## Follow-up
Manual side-by-side visual acceptance on Monday Oct 12 at 320/360/390/768/1024/1440px, both appearance modes plus System. Check loaded vs error/empty states, focus keyboard, browser refresh and persisted preference, nav tap targets/overlap, genuine profile and conversation data, and dark colors/contrast. Only after owner feedback may the next UI surfaces adopt dark tokens; do not globally flip unreworked pages.
