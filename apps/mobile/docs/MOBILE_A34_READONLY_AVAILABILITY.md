# Hustle Mobile A3.4 — Read-only appointment times in connected enquiry preview

**Date:** 2026-10-22  
**Runtime acceptance: PENDING.** No signed-in staging account, API credentials, or physical Android device were used. **No Expo APK** was queued or produced, and the owner-accepted A1 offline rollback is unchanged.

## Knowledge

PR #175 merged with Mobile, Foundation and free Android native Gradle all green, proving code readiness for connected Search → Hustler → matching published offer → unsent local enquiry. For an APPOINTMENT service the user still had to guess a time. The existing authenticated `GET /bookings/slots?serviceId=...&date=...` controller and booking schedule service already return the provider's timezone, booking mode and available future starts without writing a booking or holding capacity. The service itself must be published. Avoid a second booking model or mock calendar.

## Specification

- In the connected **service enquiry preview only**, allow the user to select one of the next seven UTC calendar dates and explicitly tap **Check available times**. This calls the existing authenticated read-only endpoint. No automatic prefetch, calendar reservation, submission or payment.
- Check that `opportunitySelectedOffer` is a canonical published `service` result with embedded `service.id` identical to the returned search `result.id`; invalid/missing IDs disable the query, never fall back to a fabricated value.
- For **APPOINTMENT** booking mode, show only backend-listed starts whose `available` is true, `remainingCapacity` is positive and start is still in the future. The date selection reflects the requested day and the labels respect the backend-provided timezone. Duplicate start times are removed; invalid timestamps or timezones are never turned into invented times.
- If the API returns **CONSULTATION** or **WORK_QUEUE**, say these modes do not supply public appointment starts. Never mislabel empty slots as unavailability of the provider generally.
- Treat availability as an instantaneous read: **displayed times can change and are not reserved**. They are preferences for a *draft*, not a confirmed appointment, availability guarantee or held slot.
- A read failure keeps the enquiry text intact, clears stale slot results and offers an explicit retry. A user can prepare the unsent draft even with zero/unknown slots.
- The draft review displays an optional preferred date/time with **not reserved** wording; without a selected time, it clearly states scheduling requires agreement with the provider.
- Each new selected day, different service, modal close, Back to service or sign-in token change invalidates in-flight reads and any chosen old slot, avoiding cross-service/date contamination.
- Reuse the existing guarded booking UI without activating `EXPO_PUBLIC_HUSTLE_ENABLE_BOOKING_REQUESTS`. There is no `POST /bookings`, notification, payment, escrow, checkout, message or persistent enquiry from this flow.

## Architecture

`apps/mobile/src/ux004/discovery/connectedOpportunityAvailability.ts` owns pure service ID validation, available appointment filtering, timezone-safe display and future date choices. `MobileExperience.tsx` holds the short-lived read-only fetch and request-sequence counter. `feed-api.ts` already provides a typed `mobileApi.slots(token, id, day)`, so no new HTTP client, backend, permissions, API routes, package or auth configuration is required. The existing preview modal is the only mobile screen touched.

All changes stay in `apps/mobile/**`; previous A3.1–A3.3 integration regressions and A1–A2.9 offline demonstration QA remain intact. The new executable Node contract transpiles and runs real helper code against synthetic API-shaped slot responses, while asserting the authoritative NestJS controller/service methods and no-write boundary.

## Deferred runtime QA (NOT PERFORMED)

| Scenario | Correct behavior |
|---|---|
| Authenticated staging, published APPOINTMENT service | GET slots only after explicit tap; offered starts reflect server's timezone and current capacity |
| APPOINTMENT service with no open starts | Explain no appointment starts returned **for that day**, do not invent alternatives |
| Non-appointment WORK_QUEUE / CONSULTATION | State real mode; no fictitious appointment slots |
| Select a different day while old GET in flight | Old response is ignored, no wrong-day times shown |
| Change service or close modal while GET is in flight | Old service's slots are never transferred to a different provider |
| Select slot then press Review enquiry draft | Preferred date/time shown with "not reserved" and "not sent" |
| Error / offline / unauthorized API | Explicit error/retry, draft preserved, no fabricated slots |
| No actual slot selected | Preview remains possible; cannot imply an appointment is booked |
| Phone 320dp, large text, TalkBack, Android Back | Date/slot chips and action reachable, time labels understandable, sheet closes safely |
| Real booking endpoint / payment systems | No requests or financial writes from the new preview |

Future acceptance must capture an approved staging API, exact commit/build, device/OS, test identity, slot response, timezone, negative-case evidence and owner sign-off. GitHub TypeScript, Metro and Gradle passes are **not** authenticated or hardware acceptance.

## Review and approval

Owner review and manual merge only after exact-head Mobile Cloud CI, Foundation CI and free native Android Gradle pass. Vercel build-rate-limit errors are tracked independently in [issue #176](https://github.com/realxpen/hustle-economy-of-you/issues/176); do not trigger paid builds or suppress legitimate deployments. Production DB, real user data, payment providers, actual booking writes and releases require separate owner approval.
