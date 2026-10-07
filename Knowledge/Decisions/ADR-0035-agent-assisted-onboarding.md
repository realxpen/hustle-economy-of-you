# ADR-0035 — Agent-Assisted Onboarding and Unclaimed Client Identities

Status: Accepted
Date: 2026-10-07

## Context

Some people Hustle is designed for may be skilled offline workers who are not comfortable using smartphones, forms, email, or online account setup.

Requiring every person to create and complete their own account on a separate device makes Agents less useful and excludes the people who most need assisted discovery.

At the same time, an Agent must never become the identity owner, learn the person's password, or silently impersonate them.

## Decision

An ACTIVE AGENT may create an **Agent-assisted registration** from the Agent workspace after recording the person's explicit consent.

The flow is:

`person gives consent → Agent creates assisted Client identity → Agent relationship becomes ACTIVE with onboarding scopes → Agent prepares/submits Hustler application → admin reviews → person may later claim the same identity`

The newly created identity:
- starts with ACTIVE CLIENT capability;
- is owned by the person, not the Agent;
- uses an internal provisional auth subject until claimed;
- may have optional email and/or phone recorded for later claim;
- can exist without the person owning a smartphone at registration time.

The Agent receives two onboarding-specific scopes:
- `ACCOUNT_ONBOARDING_MANAGE`
- `HUSTLER_APPLICATION_MANAGE`

Additional scopes may be recorded from the person's consent, but each future operation must still enforce the underlying capability required by that domain action.

## Claim handoff

The Agent never creates or stores the person's password.

When the person later authenticates with a verified email or phone that uniquely matches an ACTIVE assisted registration, Hustle attaches that Supabase Auth subject to the existing assisted identity and marks the registration CLAIMED.

The person therefore keeps:
- the same Hustle User ID;
- the same application history;
- the same capability history;
- the same Agent relationship/audit history.

If a verified contact matches more than one assisted identity, automatic claim must stop and require support resolution.

## Hustler application authority

An Agent with an ACTIVE relationship and `HUSTLER_APPLICATION_MANAGE` may:
- create/update the person's DRAFT Hustler application;
- attach private proof uploaded from the Agent's authenticated session;
- submit the application for admin review.

The Agent cannot approve the application.

Admin review remains independent and must show assisted-registration provenance, including the assisting Agent and recorded consent method.

## Ownership and audit

Every assisted action records:
- Agent as actor;
- assisted person as principal/owner;
- relationship;
- permission scope;
- entity/action context.

Assisted registration does not transfer:
- login ownership;
- wallet or funds;
- escrow or payouts;
- Reviews or reputation;
- identity ownership.

## Consequences

Agents can onboard offline/non-technical people from one Agent device without creating throwaway passwords or requiring a second phone.

Hustle gains a practical assisted-distribution channel while preserving user ownership, consent and auditability.
