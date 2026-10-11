# ADR-0060 — Web-wide adaptive UI foundation and viewport regression gate

Status: Implemented in feature branch; CI and owner runtime acceptance pending
Date: 2026-10-11
Scope: Hustle Next.js Web UX and browser checks; no API, DB, Agent grant, money or production deployment changes.

## Decision
Unify mobile/tablet/desktop behavior using **actual CSS viewport** responsive breakpoints, content-first shrinkable grids/flex children, max-sized media, readable form inputs without iOS zoom-on-focus, keyboard focus and reduced-motion support. Specialized experiences such as Discovery keep a bounded viewer with intentional internal scrolling; financial flows keep explicit values and server-authoritative statuses and must remain reachable at high zoom. Do not globally force overflow:hidden or disable user pinch zoom.

Root Web layout imports `adaptive-foundation.css`, and existing CSS modules receive scoped fixes across major economic, trust, content and account surfaces. Preserve the six canonical destinations; role progression and Agent owner permissions are unchanged. Avoid changing business rules, fake datasets, connected services, video transport, checkout authorization or blockchain/payment workflows.

Add Foundation CI static responsive contract checks and a separate read-only browser audit harness (Playwright/Chromium, manually dispatched). The audit reports horizontal page overflow and offscreen fixed navigation at known widths and explicitly labels unauthenticated redirects UNVERIFIED. Signed-in/manual device and browser testing remains a release gate and requires real data, short-height/folded browser chrome, rotation, dark/light, long text/media failures.

## Trade-offs
- Extra shared CSS guards are intentionally low-specificity; pages with bespoke layouts still require focused user/device QA.
- 16px minimum input control text on small screens prevents unwanted iOS focus zoom; it may require compact toolbars to scroll horizontally.
- Some rich modals/media players use internal scroll under short heights rather than hiding controls. Native experience is not altered by this Web change.
- Regression workflow uses an isolated browser runtime only when manually invoked; no dependency added to the app bundle and no automatic production testing or deployment.

See `Knowledge/QA/WEB_ADAPTIVE_MATRIX_V1.md`.
