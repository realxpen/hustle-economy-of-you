# UX024 — Unified Service Experience UI/UX

Founder accepted UX020–UX022 Search on the real iPhone and explicitly reported that Service, messaging, Booking and Hustler response functionality works. UX024 is a **presentation-only** milestone and must not build more workflows.

## Visual benchmark
Use accepted Explore design: soft warm paper (`#F7F6F2`), white cards, dark forest (`#18281E`), lime (`#C9F26B`), pale green (`#E4EFD7`), small corner-radius families, consistent typography and touch targets. Do not clone TikTok/X branding. Do not modify global themes or Explore.

## Scope
1. **Public Service** — prioritize real published photo/video media at the top of the mobile view, with horizontally scrollable native media and visible controls. Compact the price and two genuine CTAs, and make the professional card scan like the person profile in Explore.
2. **Request Booking** — improve hierarchy: offer summary with explicit price, timing, job details, saved draft notice and clear submit boundary. Retain server availability, honest no-payment copy, genuine form controls and all existing field behavior.
3. **Consultation thread** — compact familiar chat layout, visible return-to-prepared-request CTA and in-row Send on mobile; no fake messaging status or auto-send.
4. **Booking status detail** — prioritize real next action, status, confirmed vs proposed time, clear money boundary and readable schedule on narrow screens.

## Safety and regression
- No API, auth, schema, payment, escrow, money, notifications, trust, roles or state-machine changes.
- Canonical published media and Service price remain server sourced. `sourcePost` remains a navigation hint, not proof.
- No synthetic user content or fabricated recommendations.
- Mobile 320/390/430/760 CSS px and desktop responsive, keyboard and motion preferences. Existing Payment Sandbox and MONIFlow gates untouched.
- The new UI source contract and synthetic local Chromium booking smoke run with Foundation CI; this does not establish signed-in real-iPhone rendering or acceptance.
