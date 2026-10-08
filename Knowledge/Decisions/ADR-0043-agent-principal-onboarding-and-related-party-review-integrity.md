# ADR-0043 — Agent Principal Onboarding and Related-Party Review Integrity

Status: Accepted
Date: 2026-10-08

## Context

Hustle already allows any ACTIVE CLIENT to appoint an ACTIVE AGENT and grant named permissions.

Two onboarding scopes existed:

- `ACCOUNT_ONBOARDING_MANAGE`
- `HUSTLER_APPLICATION_MANAGE`

Phase 18C originally wired those scopes only through an `AgentAssistedRegistration`. That left an authority gap for an ordinary existing Client who independently created their Hustle account and later appointed an Agent: the permission grant existed, but the Agent had no matching delegated action surface.

Assisted registrations also need a clear ownership handoff. The Agent may record an email or phone for later account claim, but must never choose, store or know the person's authentication secret.

Finally, a verified transaction alone is not sufficient to establish an independent public-review relationship when the buyer/client is also the provider's Agent. The commercial transaction can be legitimate while the resulting public reputation signal is conflicted.

## Decision

### Existing Client onboarding

An ACTIVE AGENT with an ACTIVE relationship may use `ACCOUNT_ONBOARDING_MANAGE` for any represented ACTIVE CLIENT, whether or not that Client was originally Agent-assisted.

The delegated surface may update only basic identity/profile fields:

- display name;
- username;
- location;
- bio/about;
- avatar URL.

It must not allow the Agent to change authentication or recovery authority:

- email;
- phone;
- password;
- auth subject;
- verification state.

Every mutation records Agent actor vs Client owner.

### Existing Client Hustler application

An ACTIVE AGENT with `HUSTLER_APPLICATION_MANAGE` may prepare and submit a represented Client's Hustler application.

The Agent may:

- create/update the DRAFT application;
- attach private proof from the Agent's authenticated upload context;
- remove proof the Agent uploaded while the application is still DRAFT;
- submit the completed application.

The Agent may not approve the application or activate HUSTLER.

Admin review remains independent and exposes the delegated submission actor.

### Assisted account claim

An Agent-assisted identity has no password when it is provisionally created.

The Agent never creates or receives the person's password.

If an email is recorded, the person later uses that same email in Hustle's normal account-creation flow, chooses their own password, verifies the email, and the verified auth identity claims the existing assisted Hustle User.

If a phone is recorded, the person uses that same number through phone OTP. No password is required.

Claim preserves the existing Hustle User ID, application history, capabilities, Agent relationship and audit history.

### Agent/principal transactions and reviews

An Agent may legitimately patronize a person they represent. Hustle does not block an otherwise valid Booking or Order merely because an Agent relationship exists.

However, a public provider reputation Review is not independent when it occurs between an Agent and a current or former represented principal.

Therefore, once a Client↔Agent relationship has reached ACTIVE representation, public verified reputation reviews between those two identities are ineligible even if:

- the Booking or Order is real;
- payment succeeded;
- the transaction completed;
- escrow was released where required;
- the relationship is later revoked.

This prevents revoke-then-review reputation gaming.

The restriction applies to public reputation only. It does not transfer transaction ownership, cancel valid commerce, or grant the Agent any review/reputation management authority.

## Consequences

- The two onboarding scopes now have real meaning for ordinary existing Clients as well as Agent-assisted registrations.
- Permission revocation immediately removes the corresponding delegated action surface.
- Authentication ownership remains exclusively with the person.
- Admin reviewers can distinguish applicant owner from delegated Agent submitter.
- Agents may transact with principals but cannot turn those related-party transactions into verified public reputation.
- No schema migration is required; the correction uses existing relationship, audit and application records.
