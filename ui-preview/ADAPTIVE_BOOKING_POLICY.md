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


## Fully booked day/time UX — 31 October 2026

- Service booking calendar now shows a horizontally scrollable seven-day ribbon with Available/opening count, Full, and Closed states. Exact date input remains available for later dates. The date ribbon accounts for a user's requested head count and the professional's shared/batch/individual service delivery model.
- Time choices are labelled Full and disabled if **the complete appointment group and duration** cannot fit. A dry-run planner checks all required staff allocations and consecutive hours without reserving any resources.
- If the entire date is unavailable, the customer sees a clear message and up to four nearby opening suggestions within the next 45 days. Suggestions can directly change the date/time input; a dedicated button returns to Explore to find another professional.
- The Continue control is disabled whenever no suitable time exists and automatically re-enabled when an available time/date is selected. Submission validates availability again; there is no fallback to a default slot when the selected day is full. Concurrent/conflicting acceptances remain protected by the sample reservation check.
- A **Join demo waitlist** action records an in-memory example waitlist request, rejects duplicates and displays **no real reservation, monitoring, or future notification**. Production waitlist availability alerts require opt-in, reliable event handling, authenticated subscriptions and cancellation/rescheduling policy.
- Production requires a persistent staff-aware transactionally safe availability service, atomic holds with TTL, consistent time zones, per-resource overlap handling and actual outgoing messages. The UI preview is simulated, not a guarantee of actual booking capacity.
- Final verification: 15/15 source and booking-engine checks passed (including full day, full time, group overlap and alternatives); 7/7 UI interaction checks passed (7-day ribbon, disabled Continue, alternative date selection, re-enabled submission and demo waitlist).


## Item-based service fulfilment journeys — 31 October 2026

**New product decision:** A booking can be an appointment, a shared/batch session, or a multi-day item-based work order. Laundry, tailoring, shoemaking and opt-in repair/custom services should not automatically follow the haircut journey.

### Customer flow
1. Browse Marketplace → Services (sample Laundry wash/iron and Shoe repair listings added), open professional/listing, request booking.
2. Describe garments, shoes, outfit, quantity and care/reference details; choose how items reach professional: shop drop-off or collection from customer's general area.
3. Independently choose completed-item handover: collect at shop or professional's return delivery. If relevant, select measurements in shop, at customer location, or guided self-measurement. The tailor/shoemaker confirms sizes before production.
4. Select **item handover appointment** date/time (not an implied completion time); see a distinct **proposed ready-by date/time** computed from professional working days and configured turnaround.
5. Quote separates base service estimate, optional pickup, return delivery and home measurement fees. Professional approval and customer acceptance precede simulated payment.
6. Track work as **Awaiting handover → Items received → Processing → Ready → Out for delivery (if applicable) → Collected/Delivered**.
7. Customer gets an in-app **Orders** demo notification when professional explicitly marks items ready for pickup/dispatch, updates the ETA, marks out for delivery or confirms receipt. Notification opens the **existing** booking without resetting payment or progress.
8. Customer completes eligible milestone release only after the item handover status is recorded, and can still raise a dispute.

### Professional / Studio
- Hustler Studio → Bookings shows active example item job with status actions and a revised ready-by **date and time** editor.
- Hustler Studio → Booking setup and professional onboarding let the professional set business-day turnaround estimate, ready-by time, and pickup/delivery/measurement visit fees, plus an opt-in toggle for multi-day item work on other service categories.
- Demo progress updates are manual; no automatic completion or readiness from an estimated time. Changes create only in-memory notifications.
- Example service-specific templates and sample catalogue cards for laundry and shoemaking have been added. Tailoring uses its existing listing and new measurement and return fields.

### Production boundary
- This is **one active demo booking in memory**, not an order history, account-backed push system, actual address/route booking, driver dispatch, fabric measurement certification or payment integration. No real customer notifications are sent.
- Real implementation requires durable orders with line items, photos and measurements handled with consent, item receipts, configurable turnaround/service-level policy, actual worker allocation, signed handover proofs, pickup/delivery scheduling and exceptions, separate fulfilment tracking from payment escrow, auditable permission-scoped status changes, delayed-job notifications, notification preferences, and authenticated push/SMS/email providers with opt-in.
- Ready estimates are indicative; they must be confirmed/revised by the professional and should never auto-mark items ready.
- No production database, payment processor or hosted production UI is changed from this preview branch.


### Further UX refinements — ready-by time and guided remote fitting

- Professionals can configure a **ready-by time** as well as the estimated working-day turnaround in Hustler Studio and during business onboarding.
- The active-job ETA editor supports revising both date and time; the customer gets an in-app demonstration notification with the revised time.
- Tailoring and shoemaking each offer an additional **guided video fitting/sizing** choice alongside in-store fitting, home measurement and self-measurement instructions. The demo does not start a real call.
- Item-based services show only the collection/return/location information relevant to fulfilment, avoiding duplicated general service-venue and address questions.
- The demo offers an opt-in multi-day-work setting for other professional service categories, as well as separate pickup, delivery and measurement visit charges.
- Customer notifications differentiate **ready for pickup**, **ready for dispatch**, **out for delivery**, and **delivered/collected**. Ready states require an explicit professional action; they are not triggered automatically by the estimated date/time.
