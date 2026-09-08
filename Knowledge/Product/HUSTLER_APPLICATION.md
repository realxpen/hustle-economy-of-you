# Hustler Application + Verification

## Purpose

Phase 3 allows an existing Hustle Client to apply for the Hustler capability.

It never creates another account.

CLIENT
↓
Application
↓
Verification
↓
Approval
↓
CLIENT + HUSTLER

## Canonical flow

Client
↓
Apply to become Hustler
↓
Select primary skill
↓
Select category
↓
Describe experience
↓
Provide optional business information
↓
Attach portfolio / capability proof
↓
Submit
↓
Admin review
↓
Approved or rejected

Approval activates HUSTLER on the existing User.

CLIENT remains ACTIVE.

## Application states

- DRAFT
- SUBMITTED
- UNDER_REVIEW
- APPROVED
- REJECTED
- SUSPENDED

Application state and capability state are separate.

## Application information

Required foundation:

- primary skill
- category
- experience summary
- years of experience
- capability proof
- identity verification state

Optional:

- business name
- business information
- certificates
- supporting documents

## Authorization

Applicants may manage only their own application.

Applicants cannot:

- approve themselves
- activate HUSTLER directly
- change review status
- change verification result
- assign reviewers

Approval must happen server-side.

## Approval invariant

Approval must atomically:

1. mark the application APPROVED;
2. create or activate `UserCapability(HUSTLER, ACTIVE)`.

CLIENT must remain ACTIVE.

## Phase boundary

Phase 3 does not build the complete professional profile.

Phase 4 owns professional profile and public digital identity.

## Gate

A real Client can complete the application and become an approved Hustler while preserving the same Hustle User and CLIENT capability.
