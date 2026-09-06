# Progressive Capability Model

Hustle uses one account and one identity.

Initial capability:
- CLIENT — automatically ACTIVE when the authenticated provider identity is first synchronized.

Potential approved capabilities later:
- HUSTLER
- AGENT

Capabilities are additive. They do not create alternate accounts, profiles, dashboards, or a role-switching mode.

`UserCapability` is the authorization source of truth. Capability states are `ACTIVE`, `SUSPENDED`, or `REVOKED`. Provider metadata is never used as capability authority.

Phase 2 implements identity, Client-by-default and the permission primitive. Phase 3 owns the Hustler application and approval lifecycle.
