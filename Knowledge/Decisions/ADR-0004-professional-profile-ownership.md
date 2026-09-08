# ADR-0004 — Professional Profile Ownership

Status: Accepted
Date: 2026-09-08

## Context

Phase 3 proves that a Client can gain HUSTLER on the same Hustle User. Phase 4 now needs a professional identity without violating the single-account progressive-capability model.

Some profile fields are universal identity fields already owned by `User`, while other fields describe professional presentation and should only exist for approved Hustlers.

## Decision

Introduce one optional professional profile per User.

The professional profile is capability-specific presentation data, not another account or another authorization source.

`User` continues to own universal identity fields:

- displayName
- username
- avatarUrl
- bio
- location
- contact verification
- capability history

The professional profile owns Hustler-specific presentation fields:

- headline
- coverUrl
- primarySkill
- secondarySkills
- category
- professionalSummary
- yearsExperience
- publication state

Only Users with `UserCapability(HUSTLER, ACTIVE)` may create, edit or publish a professional profile.

## Bootstrap

For an approved Hustler, the initial professional profile should be bootstrapped from the approved `HustlerApplication` where possible.

The application and its proof/review records remain immutable workflow evidence. Future profile edits do not alter the application.

## Public identity

The public professional profile uses the same User username and identity.

The MVP public route is `/u/[username]`.

Only PUBLISHED professional profiles are returned publicly.

## Authorization

Professional profile editing does not grant capabilities.

`UserCapability` remains the authorization source of truth.

CLIENT remains ACTIVE when a User is also a Hustler. No role switcher is introduced.

## Phase boundaries

Phase 4 establishes the professional identity shell only.

Services, products, content, reviews, commerce and storefront behavior remain owned by their later approved phases and attach to the same identity when implemented.

## Consequences

This keeps identity data normalized, avoids separate Hustler accounts, preserves verification history and gives later marketplace/content systems a stable professional identity to attach to.
