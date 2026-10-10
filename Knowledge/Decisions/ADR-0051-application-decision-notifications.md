# ADR-0051 — Phase 20C2: Capability Application Status Notifications

Status: In feature branch; CI and Monday owner acceptance pending
Date: 2026-10-10

## Purpose

Hustle is one account with progressive CLIENT/HUSTLER/AGENT capabilities. Applicants need meaningful, private updates when their application enters review or receives a decision. The original application state machine, reviewer assignment, identity/proof checks, self-review rules and capability activation are authoritative; notifications must never become an alternate approval mechanism.

## Implemented

Hustler and Agent reviewer services now write a recipient-scoped APPLICATION notification in the **same Prisma transaction** that establishes:

- `UNDER_REVIEW` — application actively assigned to a reviewer;
- `APPROVED` — review checks completed and existing capability activation transaction has succeeded;
- `REJECTED` — rejected with existing required private reason retained in application data, not copied into notifications.

The notification goes only to `application.userId`, with a deep link to the appropriate application page. Existing reviewer action events and capability authorization checks are unchanged. Unique `application:<capability>:<applicationId>:<status>` event keys ensure retries do not duplicate alerts.

No applicant gets their own admin review powers. Notification status cannot unlock a capability; the canonical UserCapability row and server guards remain sole authority. Full rejection reason, verification documents, evidence metadata and sensitive reviewer notes are **not** exposed in inbox notification copy.

The existing Phase20A Notification table and kind APPLICATION suffice: **no database migration**. The Web inbox already displays generic types; no UI code required for this slice.

## Not included here

- Explicit verification-detail change notices (VERIFIED/REJECTED), capability suspension/reactivation, appeals outcome notices, payment events, push/SMS/email
- Backfill notifications for previously decided applications
- New application/review data models or role switching

## Monday consolidated owner acceptance

- [ ] Submitted Hustler application enters review; applicant sees one UNDER_REVIEW notice, reviewer receives none for their own action.
- [ ] Verified, proof-bearing Hustler application is approved; applicant gets APPROVED notice and HUSTLER capability is actually ACTIVE.
- [ ] Separate Hustler application is rejected; only applicant receives REJECTED notice; sensitive reason is accessible only through existing authorized application detail.
- [ ] Repeat status action does not duplicate alert.
- [ ] Mirror review/approval/rejection cases for Agent application.
- [ ] An unauthorized or self-review attempt is rejected without any notice or capability change.
- [ ] Existing Booking/Order social and message grouping unchanged.
- [ ] CI passes; owner only deploys when consolidated Monday checklist is ready.
