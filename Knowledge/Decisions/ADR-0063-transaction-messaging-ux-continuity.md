# ADR-0063 — Transaction-first Booking, Commerce and Messaging continuity

Status: Implemented in feature branch, CI and signed-in acceptance pending
Date: 2026-10-11
Scope: Next.js Web navigation, accessibility and state presentation.

## Decision
The experience should make each server-authoritative Booking/Order status intelligible and keep coordination directly attached to the original economic action. Use a compact progress timeline derived only from canonical Booking/Order status values; do not equate REQUESTED/ACCEPTED/PAYMENT_PENDING with FUNDED or PENDING with PAID. Terminal exceptional statuses (declined/cancelled/refunded/disputed) must show their real state instead of a fabricated progress percentage.

Client/Hustler/Buyer/Seller are existing per-transaction responsibilities, not global switchable account modes. Prominent CTA may open the actual direct conversation, but only Booking/Order and finance API have authority over work/payment. A path-scoped `returnTo` can help navigate from direct conversation back to an authorized Booking or Order detail; it is **navigation only**. Validate against `/bookings/:id` or `/orders/:id` and never construct redirects from arbitrary URLs or imply access. The API must still authorize the destination.

UI must not reuse previous party/transaction data on route changes while new records load. The Cart must reflect actual availability and allow recoverable changes, while Checkout must never keep a failed, stale preview actionable; it creates an unpaid Order and leaves payment to authoritative provider-confirmed workflows. No Agent finance delegation, payment state transition, backend contract or production migration is introduced.

## Trade-offs and acceptance
Progress stages are deliberately summaries, not a prediction of successful funding/delivery. Accessible navigation and non-destructive retry are favored over silent auto-submit. Signed-in real-device QA and isolated financial sandbox checks are release gates independent from CI. See `Knowledge/QA/TRANSACTION_MESSAGING_UX_BUILD2_ACCEPTANCE.md`.
