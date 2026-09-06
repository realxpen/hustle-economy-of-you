# Hustle AI Operating Manual

## Project identity
Hustle — The Economy of You — is a mobile-first, content-first capability-to-opportunity ecosystem.

Core transformation:
`Skill → Demonstration → Discovery → Trust → Opportunity → Transaction → Reputation → Growth`

## AED operating rule
Before meaningful implementation read, in order:
1. `AGENTS.md`
2. `PROJECT_STATE.md`
3. Relevant files in `Knowledge/`
4. Relevant decisions in `Knowledge/Decisions/`
5. Existing code

Implementation follows `Knowledge → Specification → Architecture → Experience → Code → Test → Validate`.

## Binding product rules
- Product name is Hustle.
- Mobile-first and Nigeria-first.
- Content is proof of capability and a bridge to economic opportunity.
- One account; every user begins as Client.
- Hustler and Agent are progressive capabilities on the same account.
- Never create a role-switcher or separate Client/Hustler/Agent accounts.
- Products and services may be attached to content.
- Trust and verified outcomes outrank vanity metrics.
- Avoid premature microservices and infrastructure complexity.

## Knowledge rules
- Raw material goes in `Raw/`.
- Current useful understanding goes in `Knowledge/`.
- Consequential architecture/product changes require a decision record.
- Surface contradictions; never silently rewrite binding decisions.
- Superseded knowledge becomes deprecated/archived rather than silently deleted.

## Current implementation model
- Monorepo.
- Mobile: React Native + Expo.
- Web/Admin: Next.js.
- API: NestJS modular monolith.
- Operational DB: PostgreSQL via Prisma.
- Cache/realtime support: Redis where justified.
- Media: object-storage adapter boundary.
- Vercel is the current preview target for web UI/UX.

## Security
Never commit secrets, tokens, payment keys, private certificates, production credentials, or user-sensitive data.
