# Hustle — Connected Journey UX Contract (Preview Milestone)

Branch: `preview/hustle-v1-posts-stories`. This is an isolated Cloudflare static UI preview, **not** the authenticated production application.

## 1. Entry, authentication and onboarding

**Splash** → Welcome → **Explore as guest** OR Sign in/Create account → Phone/Email → Demo 6-digit verification → Purpose → Display name → Skill/area (optional) → Notification preference (optional) → Feed/Profile.

- A returning session may access the sign-in journey from Profile → Settings. This preview does not implement production session persistence.
- One identity supports both client and hustler use; Agent is an application-only permissioned role; Admin is invitation-only and server-gated in the real product.
- The demo code is **123456**. No SMS, email or external identity provider is called. Never treat this simulated OTP as authentication.
- Progressive disclosure: purpose first; username, skill, area and notifications are optional or skippable; no GPS request at onboarding.
- Real implementation: provider-managed identity/session management; rate limits, anti-enumeration, device recovery, MFA for privileged users, support for low-connectivity flows; verify phone/email ownership before privileged actions.

## 2. Booking and payment

**Service details → Hire/Consult → Requirements → Preferred consultation → Professional quote review → Customer approval → Payment method → Protected milestone payment (demo) → Work → Client release or dispute → Completion → Review.**

- The quote, consultation times and payment amount are clearly sample values; the professional has not truly confirmed them.
- The simulated checkout creates a matching reference in Wallet/Escrow. Milestone release updates only that selected sample milestone in the Wallet ledger; a dispute freezes further client release in the journey.
- Real quote acceptance and funding must use a trusted server-authoritative state machine with ownership checks, idempotency, ledger reconciliation and provider custody.
- Product purchase: **Cart → Delivery → Review → Card/Bank/Wallet choice → Payment demo result**; previous method/delivery carry into the journey. Real customers should not need to pre-fund a wallet.
- No demo operation makes a live booking, transfers money, delivers an order, creates a payment-provider escrow, or charges a wallet.

## 3. Reporting and moderation

**Feed post more menu / post detail / creator profile / listing / chat / entered Live room → Report → Reason + optional details/screenshot → Confirm → Receipt + report reference → My reports/status.**

- Example report reasons: misleading/fraudulent, harassment, unsafe behavior, impersonation, privacy and other.
- The sample report enters the separate Admin moderation sandbox's queue, where a demo reviewer can mark it reviewed or escalated; the reporter's sample history and System notifications update.
- The screen distinguishes content reports from financial **Escrow disputes**; payment protection requires a separately tracked evidence/hold/review process.
- No report or selected image is uploaded, submitted to a real moderator or sent to another user.
- Production needs content/report target versioning, privacy-preserving evidence uploads, retention policy, moderator RBAC, appeals, abuse prevention, confidential outcomes and auditable actions.

## 4. Agent journey — existing vs non-tech-savvy new professional

**Agent Studio (approved and consented) → Add a hustler → Existing Hustle user OR New professional → Selection/details → Explain scoped permissions → Explicit consent → Review → Invite pending → Hustler personally accepts / declines → Delegated management.**

- Existing: sample profile search and requested permissions; agent cannot silently claim or merge an existing account.
- New: name/skill/work area, preferred explanation language (English, Yoruba, Pidgin, Igbo, Hausa or Other), and handover channel (in person, voice-assisted or printed instructions).
- No actual invitation is sent. The *recipient acceptance* button is explicitly a separate demonstration, not authority granted to the agent.
- Assistive workflows must not require the professional to be tech-savvy or to own a smartphone immediately, but activation of identity and consent must remain theirs. Agents must not obtain their OTP, PIN or password, release their escrow, or withdraw earnings. Real withdrawal requires the hustler's own verified confirmation.
- Production needs invitations with expiry, recipient verification, account-linked permissions, scopes, revocation, role checks, delegated booking audit and protections for offline/lower-literacy onboarding.

## 5. Notifications

- Dedicated screen via **Inbox header, Profile alerts or Settings**.
- All / Booking / Money / Orders / Activity / System tabs, read/unread distinction, mark all read, preferences and deep links to the corresponding demo journey.
- Example events: consultation request, wallet milestone, order updates, report review, account/onboarding and agent invitation.
- Tapping Money/Escrow first closes the overlay so the Wallet destination is actually visible.
- The application does not request push permission on Splash, guest browse or onboarding without the user's explicit choice.
- Real implementation needs authenticated per-user delivery, unread counts, idempotent fanout, preference enforcement, deduplication, privacy-safe payloads and sound deep-link behavior.

## 6. Shared motion rules

- Splash logo/orbit and short entry transition, lightweight step progress, selected states, notification indicators, confirmation dialog, success checkmark, and non-blocking feedback.
- Most transitions approximately 150–300ms; avoid perpetual heavy animation in normal work surfaces.
- All animations and transitions respect `prefers-reduced-motion`; forms use at least 16px input fonts to avoid iPhone focus zoom.
- Never simulate payment success, a live OTP message, a real invite, an admin role or an actual broadcast through animation.

## Implementation

New static assets:
- `ui-preview/dist/hustle-journeys.js`
- `ui-preview/dist/hustle-journeys.css`

Updated:
- `index.html`: loads both.
- `hustle-flows.js`: connects booking, product checkout, reports, inbox/notification/settings, and the signed-in-profile demo.
- `hustle-operations.js`: syncs booking escrow references, agent invitations, report moderation and user status.
- `hustle-commerce-live.css`: in-room reporting control.

### Technical boundaries

**No real OTP, auth provider, session cookie, external notifications, invitations, content uploads, banking credentials, escrow custody, money movement, real orders or Admin authorization are implemented in this branch.** All journey state lives in memory and resets on reload.

Production integration must be separately implemented with authenticated APIs, actual database constraints, server-side policies, payment-provider integration where permitted, audit logs, disputes and legal/privacy/security review. Never merge this static demo as a working production backend.

### Testing

- Syntax/asset safety checks passed for the connected modules.
- 35/37 initial stand-alone journey checks passed; the two apparent misses were text assertion differences (HTML-escaped apostrophe and singular label), not broken interactions.
- 12/12 cross-workspace checks passed: Report → Admin → updated status, booking → linked Wallet escrow/release/dispute, notification → correct destination, agent invite → pending/accepted demo.
- Final connected UI source and static cross-module checks should be rerun after any further integration changes.
- Real iPhone Safari layout, low-bandwidth behavior and Cloudflare's latest deployed revision require device validation; simulated DOM tests are not browser E2E tests.
