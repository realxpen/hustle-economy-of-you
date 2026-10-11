# ADR-0066 — You as Hustle's identity and activity home

Status: PR #100 merged; Foundation CI 38167419625 passed; owner deployment and signed-in iPhone acceptance pending
Date: 2026-10-11
Scope: Next.js Web /account, Trust activity presentation and frontend-only tests. No API/schema, role/capability, finance, consent persistence or Agent authorization changes.

## Evidence and problem
Owner's real-device screenshot shows /account still uses early global CSS, stacked cards and numerous tiny tag links. The public Discover experience now uses an adaptive expressive visual system, but You does not. The Trust activity component's white-on-dark hardcoding creates unreadable pale content on the account's light background. The long page buries actual user tasks and optional consent below several screens of navigation links.

## Decision
Use the existing mobile-first adaptive theme and root six-destination navigation. Redesign /account with a compelling current-user hero, API-backed capability pills (one identity: Client plus progressively approved Hustler and Agent), and narrowly scoped contact verification when email/phone state is verified. No generic "verified" claim for Hustler, Agent, or seller reviews.

Place authentic Bookings, Orders, Messages, Wallet shortcuts first. Group creator actions in a Hustler studio without inventing published content, earnings, follower statistics, or role switcher. A Client can still post and share Stories; Hustler-only Service/Product/Live management is rendered only when Hustler ACTIVE. Agent workspace requires an actual AGENT ACTIVE capability; consent/revocation still belongs to the backend. Preserve profile editing, safety appeals, agent management and all existing routes.

Keep Privacy & optional attribution and Trust & Safety on the page as accessible native expanders. Expand on demand so the initial page is usable without mounting/loading private datasets before requested; the original consent toggle and audit/review/block controls are still accessible. Semantic tokens ensure Trust and review content remains legible under light/dark/system without duplicating true verification or revealing admin evidence.

## Trade-offs, gates
Adaptive compact typography and quick cards do not prove phone/browser rendering. Validate 320/360/390/430 widths, 100–200% text, desktop keyboard, direct deep links to disclosures, dark/light, truthful statuses and sign-out recovery. Frontend CI validates sources and builds; authenticated browser QA and production release require owner approval. No automatic deployment.
