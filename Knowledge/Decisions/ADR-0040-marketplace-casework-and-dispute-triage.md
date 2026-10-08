# ADR-0040 — Marketplace Casework and Dispute Triage

Status: Accepted
Date: 2026-10-08

## Context
Phase 19A supplies read-only operational visibility; 19B adds controlled capability operations. The marketplace still needs internal case ownership and evidence capture when Booking or Order problems occur.

A case is **not** a financial transaction, a SafetyReport, a verified Review, or a finding of wrongdoing. Treating case closure as an escrow or reputation command would cross the platform's financial and trust boundaries.

## Decision
Phase 19C adds an AdminGuard-only MarketplaceCase and MarketplaceCaseNote workflow.

Subjects:
- BOOKING (must reference an existing Booking);
- ORDER (must reference an existing Order).

There may be **one active case record per transaction** in this MVP; a previously closed case may be reopened instead of duplicating investigations.

Internal case state:
- OPEN → IN_REVIEW;
- IN_REVIEW → WAITING_INFORMATION or RESOLVED;
- WAITING_INFORMATION → IN_REVIEW;
- RESOLVED → CLOSED or IN_REVIEW;
- CLOSED → IN_REVIEW.

Every state/priority transition requires a reason and creates both an internal note and a durable SystemEvent. Resolving a case stores an explicit resolution statement. Reopening clears the previous resolution and closure timestamps so an old resolution is not misrepresented as current.

Priority:
- LOW, NORMAL, HIGH, assigned by a human admin;
- priority never automatically punishes a user or changes a transaction.

Ownership:
- an authorized admin opens cases;
- an unassigned case, including a closed case that needs reopening, may be claimed by an admin;
- only the assigned admin may update priority/status or write notes;
- the assigned admin may release the case to the shared queue;
- assignment checks guard mutations at the database operation boundary.

Evidence:
- internal append-only notes are attributed to their author;
- opening, claiming, releasing, updating and noting cases emit SystemEvents with admin actor and case ID;
- transaction data is read from canonical Booking/Order and PaymentAttempt/EscrowRecord tables.

Storage/privacy:
- both new tables have RLS enabled and **no client-facing policies**;
- all access goes through existing `AuthGuard + AdminGuard`;
- case notes remain internal; clients, Hustlers and Agents cannot access them.

## Non-authority — explicit prohibition
These operations **never**:
- change Booking/Order status;
- confirm payment;
- reserve/release/refund escrow;
- trigger payout;
- create or modify Reviews/UserReputation;
- suspend an account;
- automatically mark a SafetyReport ACTIONED.

The admin case is a coordination and documentation artifact, not adjudication or a money-moving ledger.

## UI
Standalone Admin Console:
- `/cases` queue and investigation workspace;
- `/cases?subjectType=BOOKING|ORDER&subjectId=...` pre-fills a new case from marketplace operations;
- operator sees the current canonical transaction, payment and escrow statuses read-only.

## Follow-on
Case attachments, external party requests for information, financial dispute resolution, and supervised enforcement require independent policy and permission decisions.
