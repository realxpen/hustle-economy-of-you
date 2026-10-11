# ADR-0064 — Creator publishing surfaces and honest Live/profile state

Status: Implemented in feature branch; full CI, deployment and signed-in browser acceptance pending
Date: 2026-10-11
Scope: Next.js Web only; existing publishing APIs, identity, trust, payments and Live media transports unchanged.

## Why
Hustle needs an intuitive proof-to-opportunity creation loop, not unrelated Post, Story, Live and professional profile management UIs. The source review uncovered an unconditional `HUSTLER · VERIFIED` label in the editable profile preview even when no trustworthy verification state was present, which could misrepresent identity.

## Decision
The one account remains a Client identity that may progressively gain Hustler capability. Post publishing is available to users under the existing API and media/reference rules. Story remains available to all users, with explicitly expiring content. Only eligible Hustlers with published professional profiles may create commerce Live sessions. Link the creator formats from their existing screens; **do not add a mode or account switcher**.

Profile editor preview must label Hustler capability independently from contact verification; use existing `emailVerified || phoneVerified` for a specifically scoped contact badge only. Never imply transaction-backed Review verification.

Story uploader validates media MIME and size locally before submission, renders local preview via cleaned-up `URL.createObjectURL`, maintains real backend validation and 24-hour lifetime. Story route changes must clear previous Story and private replies.

Live preparation must be visibly distinct from broadcasting. A prepared room cannot be marked Live without an actual connected native publisher or a valid saved playback source; changing an unsaved URL does not make it active. Server and real provider still decide authorization, publishing, and transport. Never fabricate a Live viewer/video or enter an API broadcast transition without the host's explicit action.

## QA gates
Automated build and source contracts; subsequently signed-in desktop/iOS Safari/Android tests at narrow widths and large text. Story upload, public expiration, real Live media availability, host permissions, private replies and rate/permissions behavior require authorized runtime testing. No production deployment or live broadcast was performed in this build.
