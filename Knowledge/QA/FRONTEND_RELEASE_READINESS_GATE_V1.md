# Hustle Frontend Stabilization — Release Readiness Gate V1

Date: 2026-10-11
Status: NOT ACCEPTED — merged builds #96/#97/#98 have not yet received owner-deployed Web or signed-in cross-device acceptance.
Owner release authority: GitHub Actions `Hustle Manual Production Deployment` on main only, `project=web`, `confirm=DEPLOY`. Do not trigger on the owner's behalf.
Product: Hustle. One account; Client is the baseline and Hustler/Agent are progressively granted capabilities.

## Evidence tiers
| Tier | Test / evidence | What it verifies | Current |
|---|---|---|---|
| A | Foundation CI contracts, 4 workspace TS checks, Prisma, Web/Admin/API production builds | Source and compilation | PRs #96–#98 passed; stabilization PR pending |
| B | Local Chromium build smoke (320, 390 normal/short, 768, 1440 CSS px; light/dark) | Rendered public page shells, 200-class HTTP, visible main, basic overflow, brand | Implemented in stabilization PR; not yet passed |
| C | Owner-triggered `Hustle Responsive Browser Audit` vs approved HTTPS deployment | Deployed viewport geometry; 404/500 failure; explicit INCOMPLETE for unauthenticated | Not yet run on new deployment |
| D | Physical iOS Safari / Android Chrome / desktop authenticated review, platform-level browser text zoom and rotation | Actual UX and permissions | NOT TESTED |
| E | Isolated payment sandbox and real restricted Agent grants/revocation test accounts | Economic and authorization invariants | NOT TESTED for merged UX |

A CI pass is not a launch or production QA pass. All five tiers must be explicitly reviewed, with any N/A justified.

## Owner-run browser acceptance matrix (no real monetary operations)
- [ ] Verify production Web SHA matches approved main, and deployed API compatibility. Note deploy time, environment and selected SHA; otherwise STOP.
- [ ] Anonymous first visit: Brand shell; Discover content-first layout, safe 100% zoom; Story/Live public read modes; sign-in; no fabricated verification.
- [ ] iPhone Safari: 320/360/375/390/430 CSS-like widths, 100% plus enlarged website text, short screen, safe-area, tap targets, portrait ↔ landscape, keyboard, dark/light/System. Native Safari capture required; Chromium emulation is insufficient.
- [ ] Android Chrome small/large text: Discover rail/offer CTA, six-route bottom dock, scroll snap, cards, media, keyboard, reduced-motion and screen reader.
- [ ] Desktop browser at 768/1024/1440 and 200% zoom: no horizontal clipping, keyboard-only nav, focus trapping/return in quick views, visibly distinct selection/failure.
- [ ] Discover → post quick view → canonical Service/Product → owner Profile; Booking preconsult/Cart link and return-to-post context.
- [ ] Booking → authorised counterpart Messages → return to status; rapidly change Booking/Order IDs; no stale owner/price/payment details.
- [ ] Product variant → Cart available/unavailable → current server Checkout preview → unpaid Order status; NO live payment or real order creation by unattended automation.
- [ ] Client Story TEXT/IMAGE/VIDEO upload with supported MIME/size, local preview and 24-hour expiry; test Story A private reply latency + navigate to B; B never inherits A reply, draft, viewer counts or reactions.
- [ ] Published-profile trust: capability ACTIVE not equivalent to identity verified. Only existing email/phone verification yields scoped contact badge; transaction-backed reviews stay separate.
- [ ] Live DRAFT cannot broadcast blank; only actual publisher or saved valid fallback. Real media transport, controls, audience audio, pinned offers and chat under authorized test account; no simulated success.
- [ ] Agent explicit consent/revocation/cross-principal denied under API; no financial delegation; verify audit in existing test systems.
- [ ] No sensitive user details, cookies or signed-in storage state in committed GitHub artifacts or screenshots. Remove any credentials from logs.
- [ ] Review dependency audit warnings and data retention/deletion/indexing requirements before widening launch.

## Decision log
Deployment currently points to older Web commit `d5f4b2b`, while source main at start of stabilization was `4396d60`. Browser audit of the old deployment must not stand in for QA of #96–#98. Backend/authenticated testing cannot be honestly inferred from unauthenticated local smoke. Document real failures here before declaring GO.

## GO/NO-GO
**NO-GO** until CI (A/B) is green on final main, owner releases and confirms matching SHAs, deployed audit results are recorded (C), signed-in physical-device flows pass (D), and isolated finance/Agent permission risks are verified (E). Any unexplained privacy, overcharging, false payment confirmation, cross-user data, or blocked core navigation defect is a release blocker.
