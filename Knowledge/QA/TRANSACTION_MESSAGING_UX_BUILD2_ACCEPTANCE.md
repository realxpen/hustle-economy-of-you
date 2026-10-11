# Booking, Cart, Checkout & Messaging — Experience Completion Pass 2

Date: 2026-10-11
Status: Feature branch implementation; CI, owner release and runtime acceptance PENDING.
Scope: Hustle Next.js Web; no API, schema, payment authority, role/Agent or native Mobile changes.

## Product intent
Continue the real proof → opportunity → transaction journey rather than creating disconnected dashboards. A buyer should understand what is requested, what is only pending, who they are dealing with and how to message them without losing the original transaction. A seller should see the same authoritative status without role switches or imaginary payment events.

## Implemented
- Status-driven Booking and Order journey progress; stages map to canonical server statuses. Cancellation/decline/dispute/refund display the actual exceptional state **without pretending completion**. Booking funding is shown as confirmed only when `paymentBoundary.funded` is true (or clearly marked not required); Order payment only when `paymentBoundary.paid` is true, regardless of other progress states.
- Prominent next-step panels on Booking/Order detail with links to actual counterpart Messages and original Service/Order list. Booking and Order loaders ignore stale out-of-order API responses after route changes, with loading and retryable errors.
- A strictly constrained internal `returnTo` parameter permits only real Hustle `/bookings/:id` or `/orders/:id` URLs (no external redirect). Direct conversation creation preserves it, and the opened thread presents a return to the authoritative transaction. Booking owner/Order seller identity remains based on API response, not a URL.
- Conversation thread discards the previous participant/message state while a different thread loads and rejects out-of-order network responses; preserve existing API read receipts, typing, agent-attribution and private attachments. `returnTo` survives clearing post/product context on message send/remove.
- Cart uses shared ExperienceHeader and UX loading/retry states, protects overlapping quantity/remove/clear actions, asks confirmation before clearing, and flags API-declared unavailable items instead of showing a misleading Checkout CTA.
- Checkout uses a fresh server preview with request-version guarding, invalidates its previous preview after failure, labels the button **Create unpaid Order**, and does not equate Order creation with payment.
- Multiple-orders checkout routes to Order list with a modest "Review Orders" notice, not a payment success banner. Service Booking form prominently offers consultation without sending a Booking request.
- Same orange/paper/ink language and mobile responsive guards for new handoffs. Static journey checks wired into Foundation CI.

## Runtime acceptance required (PENDING)
- [ ] iPhone Safari small/large website text, Android Chrome, desktop keyboard and tablet: Booking/Order progress & next-step links remain legible and reachable.
- [ ] Client → Service → Consult → Message with SERVICE context; no booking is created by consultation. Return to actual Booking after a real Booking has been made in **isolated test sandbox only**.
- [ ] Seller/Buyer permissions remain API-authoritative; no Client/Hustler role switching and no Agent payment powers.
- [ ] Order with one Product, multiple Products, one or multiple seller groups; server Cart stock/price and Checkout preview before creating an **unpaid** Order in owner-approved sandbox only.
- [ ] Unavailable Cart line stops checkout navigation until removed/reviewed, but does not claim inventory is reserved. Network failure can retry without stale price/owner.
- [ ] Rapid switching among two different Booking IDs, Order IDs and conversation IDs never shows former participant/private thread or outdated seller/payment info.
- [ ] Query injection with `returnTo=https://evil.example`, `//evil.example`, `/wallet`, `/bookings/../wallet` never creates a navigation link; only validated internal transaction detail links work.
- [ ] In Messages, sending/clearing a PRODUCT/SERVICE context does not erase valid `returnTo` while private files, read receipts, thread send/receive and grouping continue working.
- [ ] Confirm a Booking can proceed when funding is not required without showing a false “Funding confirmed” checkmark; for paid Bookings the checkmark needs explicit `paymentBoundary.funded`. Order payment needs explicit `paymentBoundary.paid`.
- [ ] Verify pending payment and provider confirmation, refund and dispute statuses against isolated payments test environment, **not real money**.
- [ ] Light/dark/system contrast, iPhone dynamic browser chrome, mobile dock, safe-area keyboard and screen-reader tab/focus behavior.
- [ ] Owner manually deploys Web after deciding acceptance of pending PR; no automated production deployment by assistant.

## Important limits
CI and source contracts do not prove real-device behavior. The status steps are summaries of **server state**, not payment/payout capabilities. No financial transaction, booking submission or Order was executed during this code change.
