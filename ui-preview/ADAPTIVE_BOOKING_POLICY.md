# Hustle — Adaptive Service Booking Policy (Preview V2)
Date: 2026-10-31
Status: UI simulation; no real booking inventory, payment or escrow provider connected.

## Decision
A consultation is **not universally required**. This decision supersedes any older MVP rule forcing all hiring through a consultation. Service booking must adapt to the individual skill, listing, business operation and customer request. The hustler controls whether consultation is off, optional or required. The client can skip an optional consultation and attach text/media references instead.

## Discovery-to-booking journeys
- The social-first post, professional profile or service detail opens the same booking engine using the listing and provider.
- **Direct fixed-price:** brief/reference, service location, time, party size → send request → professional accepts / declines / suggests new time → fixed quote → checkout → service status → completion/review.
- **Optional free consultation:** customer opts in, chooses channel → professional accepts → consultation → proposal / quote. Customer may decline further booking.
- **Optional paid consultation:** customer opts in → professional accepts consultation before fee collection → fee (separate payment) → service quote → optional credit deducted once at service checkout.
- **Custom home/event/group:** reference media, location, guest count, date/time → custom professional quote with service subtotal, staff time, travel and event extras → client accepts → team slots assigned → payment → work/milestones. Group event scheduling may require more than one time block.
- **Examples:** barbering (direct cut, optional consult, home/group), tailoring (style/measurements/deadline), shoemaking (repair/photo/size, direct), cooking (menu/diet/portions), education (assessment then sessions), home services (fault/site diagnosis), photography (event/deliverables).
- Consumer should only see fields relevant to the skill; default template may be overridden by the professional. Always display actual optional/required conditions.

## Consultation credit semantics
Example: service ₦5,000 and optional consultation ₦1,000, credited toward service.
After consultation is accepted and the customer pays ₦1,000, a later confirmed ₦5,000 service quote has a remaining service payment of **₦4,000**, not ₦5,000. Total paid across both stages is ₦5,000 (before any explicit additional fees). Without credit, amount due remains ₦5,000 and total paid is ₦6,000. The fee is never credited more than once or more than the payable quote.
An abandoned service booking does not automatically imply a consultation refund. A real provider must disclose cancellation/refund conditions before the paid consultation begins. Consultation payment must not occur before a professional accepts the request.

## Team scheduling and capacity
- Current preview policy scopes capacity and reservations by **professional + skill + date + time**, not across all barbers globally.
- Example capacity: 4 staffed appointments in the 1–2 p.m. slot. A fifth simultaneous booking for that professional is rejected; another professional remains unaffected.
- A six-person booking for a four-person team requires two one-hour demo blocks: 4 units from 1–2 p.m. and 2 units from 2–3 p.m.
- Multi-block reservation is all-or-nothing. If later blocks lack capacity, the whole schedule request fails. Unpaid abandoned/cancelled requests release their slot holds in the preview.
- The real backend needs provider/staff/resource IDs, timezone-aware dated bookings, working hours, breaks, staff assignment, session duration, leave/blocked dates, expiry of holds, no-show policy, buffer/travel time, and transactional concurrency controls. **The demo's 'Tomorrow' slot strings and in-memory map are not availability.**
- One provider can publish several services. Production policy should be keyed by service/listing and provider, with shared staff calendars to prevent conflicts between different services, not merely independently keyed skill-category capacity.

## Studio ownership / agent permissions
- Hustler Studio → Booking setup provides consultation policy, fee, credit toggle, starting price, appointments per slot, duration, travel fee and event fee for selected sample professionals.
- The preview's rules are local session settings, not saved to accounts.
- Agents can assist with booking requests or scheduling only under explicit professional authorization, cannot approve financial releases or independently withdraw the hustler's money.
- Professional approval and customer acceptance are separate steps. The client controls later escrow milestone releases or disputes.

## Payments and trust
- Before payment, display quote subtotal, travel/event fees, consultation paid, credit, outstanding service price, refund rules and milestones.
- Real settlement requires a licensed payment/custody arrangement, authoritative ledger, idempotency, provider webhooks, audit trails and server authorization.
- The preview simulates all payment/escrow events. It does not collect money or guarantee appointment capacity.

## Acceptance checks
1. Barber direct booking skips consultation; professional can accept/decline.
2. Paid consult payment is offered **after** professional approval, not before.
3. ₦5,000 service − ₦1,000 credited consultation = ₦4,000 outstanding.
4. The same slot accepts 4 individual bookings for a 4-person team, rejecting a fifth. A different professional remains available.
5. Six-person team request reserves the two required consecutive blocks or fails cleanly, and cancel frees both.
6. Shoemaker skips consultation when configured off.
7. Studio can change only the selected sample professional's policy and can preview the resulting customer journey.
8. Close/replace an unpaid request releases held demo capacity. Paid service records are not silently cancelled.
9. No demo control charges a card, creates real escrow, or impersonates a provider's confirmation.


## UI/UX implementation — marketplace and booking screens (31 October 2026)
- Existing service-detail pages now include a compact "How booking works" component presenting the individual professional's consultation policy, duration and parallel staff capacity; booking CTA dynamically reads "Request booking" or "Request consultation". The deprecated generic message saying consultation is mandatory has been removed from service details and booking chat.
- Marketplace listing/sticky footer price now reads a professional's explicitly overridden demo service price, and the connected booking journey uses that same amount. Default listing prices are preserved until a professional edits the relevant example policy.
- Booking overlay uses four concise progress segments: Your request → Review & approval → Secure payment → Complete. The request UI organizes category-specific fields, day/time, reference photo/video, consultation options and an itemized estimated quote into visually distinct sections. There are no redundant consultation controls when consultation is off.
- Dynamic example quote responds to changes in group size, service mode, home/event fee, and consultation choice without submitting or wiping the form. An optional paid consultation shows potential fee credit as conditional on completing the service, rather than falsely treating an unpaid fee as credited already.
- Reference media selection renders a local thumbnail or playable local video; a blob URL is revoked on exit or service switch and nothing uploads.
- Hustler Studio → Booking setup exposes editable consultation policy, fee/credit, price, duration, staff capacity, travel and event add-ons for demo professionals, and a customer journey preview shortcut.
- Tested: 11/11 syntax/assets and source integration checks; 8/8 interactive form/estimate/media checks; 14/14 end-to-end simulated booking and scheduling checks. Actual iOS Safari visual QA and live Cloudflare deployment were not verified.
- Assets changed exclusively inside `ui-preview/dist/` plus this preview document. No real authentication, payment provider, production API/database or production deployment was modified.


## Staff-aware calendar and professional application UI — 31 October 2026

### Customer screens
- The request form now uses a **native exact-date picker** covering today through the next 365 days. Relative-only selectors (Tomorrow/This weekend/Next week) are removed from the visible booking form.
- Available hourly booking windows are generated from that professional's configured open/close times, days of operation, worker status, booked capacity and minimum per-session duration. Unavailable slots are disabled; longer sessions cannot start too near closing. Real calendar inventory remains disconnected.
- Customer quote dynamically shows head count, pricing, conditional consultation credit, team availability and estimated time. A two-person 45-minute haircut requires about 90 minutes from a solo barber, but may take 45 minutes when two barbers can work simultaneously.
- Booking policies distinguish **individual** work (one service per customer), **shared** group sessions (e.g. one tutor teaches six students together) and **batch** work (e.g. 20 meals in batches of 10). Group-session flat pricing versus per-person/item pricing is configurable.
- Selected booking date and time are validated against the example business's working calendar before requesting professional approval. Final appointment acceptance/escrow remains simulated.

### Professional application and ongoing management
- Signup/onboarding for users offering skills now has an optional **Set up my services** path into a four-step business application: (1) business/skill/solo vs team, (2) service pricing/consultation/duration/group model, (3) actual staff roster, and (4) operating hours/working days.
- Profile → Hustler Studio → Team & hours exposes a workforce dashboard. A manager can add workers, mark them active, on leave, or departed, and mark specific days unavailable.
- Active worker count limits the provider's real-time demo capacity; a team with zero active workers offers no appointment spaces. Departed staff remain in the history, not the availability pool.
- The service-specific Booking setup page also exposes individual/shared/batch work type, batch size, and flat/per-person charging. Existing optional consultations and consultation-fee credits remain configurable.
- Agent-assisted signup/consent remains a separate workflow; an agent cannot approve on behalf of the professional, bypass identity checks or control financial releases.
- The current preview uses an in-memory workforce, simple hourly booking windows and example date/status controls. It does **not** persist rosters, verify staff identity, allocate actual individual worker IDs to bookings, manage cross-service shared resources, or reassign existing real jobs on departure. Those require a secure server-side schedule/permissions/notification model.

### Verification
- 21/21 rule-engine and source checks passed after introducing business staffing and the exact date picker.
- 14/14 mocked business-onboarding interactions passed: setup steps, service policy, staff addition, completed hours, departure, leave-day capacity and closed days.
- 21/21 additional service/duration/source checks passed including shared tutorials, batches and flat pricing.
- 8/8 mocked booking UI checks passed: native calendar, date-responsive options, worker departure impact and shared teaching duration.
- A final scheduling fix rejects late-day appointment windows that cannot fit the selected service duration.
- No production DB, payment provider, real authentication, or deployment was touched. Cloudflare redeployment and physical iPhone Safari visual acceptance remain unverified.
