# ADR-0039 — Admin Capability and Application Operations

Status: Accepted
Date: 2026-10-07

## Context

Phase 19A gives the Hustle team marketplace-wide read visibility, but capability review actions still live in the main Hustle web app and there is no explicit operating-console control for temporarily disabling an approved Hustler or Agent.

Permanent account bans, CLIENT revocation and financial intervention have much broader consequences and should not be bundled into the first admin write slice.

## Decision

Phase 19B adds two controlled write surfaces to the standalone Admin Console:

1. unified Hustler and Agent application review;
2. reversible HUSTLER/AGENT capability suspension and reactivation.

All actions remain protected by `AuthGuard + AdminGuard`.

## Application review

The admin console reuses the existing authoritative review APIs and invariants:

- applicant cannot review themselves;
- SUBMITTED must enter UNDER_REVIEW before a decision;
- the assigned reviewer owns the active review;
- private proof is opened through a short-lived signed URL;
- identity must be VERIFIED before approval;
- at least one proof item is required;
- approval activates the capability on the same unified User identity;
- rejection requires a reason.

The standalone admin UI does not duplicate review business logic.

## Capability suspension

Phase 19B permits suspension/reactivation of:

- HUSTLER
- AGENT

It does not permit direct CLIENT suspension or permanent capability revocation.

Suspension requires a non-empty operational reason and transitions:

`ACTIVE → SUSPENDED`

Reactivation requires a non-empty operational reason and transitions:

`SUSPENDED → ACTIVE`

The corresponding approved Hustler/Agent application mirrors `SUSPENDED` while the capability is suspended and returns to `APPROVED` on reactivation.

Original reviewer notes are preserved. Suspension/reactivation reasons live in durable `SystemEvent` audit entries.

## Runtime effect

Existing domain authorization already checks capability state.

Therefore:

- suspended HUSTLER loses Hustler-only owner and delegated authority immediately;
- suspended AGENT loses Agent workspace/delegated-action authority immediately;
- Agent relationships are not destroyed by temporary suspension;
- reactivation can restore authority without reconstructing relationship history.

## Explicit exclusions

Phase 19B does not add:

- CLIENT account ban/suspension;
- permanent HUSTLER/AGENT revocation;
- automatic relationship destruction;
- financial intervention;
- Review/reputation mutation;
- automatic punitive action from a single report.

Those require separate policy decisions.
