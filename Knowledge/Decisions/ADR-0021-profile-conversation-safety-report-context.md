# ADR-0021 — Profile and Conversation Safety Report Context

Date: 2026-09-15
Status: Accepted

## Decision

Hustle safety reports support four durable contexts:

- `BOOKING`
- `ORDER`
- `PROFILE`
- `CONVERSATION`

`SafetyReport` uses a dedicated `SafetyReportSubjectType` instead of reusing the public-review `ReviewSubjectType`. This keeps moderation/reporting concepts independent from provider-review concepts.

## Authority

### Booking / Order
The server derives the reported target from the authenticated participant and the transaction. The browser does not choose `targetUserId`.

### Profile
The report subject is the profile owner's canonical User ID. The server resolves that User and rejects self-reporting.

### Conversation
The authenticated reporter must be a participant in the direct conversation. The server derives the other participant as the report target. Historical conversation content remains intact.

## Duplicate rule

One reporter may submit one report per `(subjectType, subjectId, category)`. Different categories remain independently reportable when there are distinct safety concerns.

## Privacy and reputation boundary

Safety reports are private Trust & Safety evidence. They are never exposed by public trust/profile APIs and never mutate `UserReputation`.

## Product behavior

- Public professional profiles expose a private report action only to signed-in viewers who are not viewing themselves.
- Direct conversations expose a private report action for the other participant.
- Blocking remains a separate user-to-user control and does not delete historical messages, transactions, reviews, or reports.
- A single report alone does not automatically punish a user; moderation decisions require evidence, pattern, or corroboration according to Hustle trust policy.
