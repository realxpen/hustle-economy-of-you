# Hustle Adaptive Economy — Implementation Contract (v1 draft)
Status: UI preview integrated. Backend NOT IMPLEMENTED or deployed.
Branch: preview/hustle-v1-posts-stories.
Date: 31 October 2026.

## 0. Foundational decision

Hustle is a single-account platform that exposes context-specific capabilities
rather than rigid mutually exclusive user roles. A person can be a client,
creator, skilled professional, founder and agent. A workspace represents a
personal business identity, company, team or agency. Permissions depend on the
authenticated actor, workspace membership, consent and specific operation.
The feed remains social-first. The work record links discovery to economic
fulfilment.

Use AED's observation/evolution feedback loop without allowing adaptive UI
settings or AI suggestions to override money, identity or consent safeguards.

### Three independent axes
1. **Identity**: authenticated person, verified claims, public personal profile,
   creator/social graph, personal reputation and privacy preferences.
2. **Economic context**: personal workspace, business, branch, team, products,
   available staff/equipment, customer/work history and its independent finances.
3. **Capability grant**: hire, offer, sell, create, teach, manage, represent,
   learn. Capability grants alone NEVER imply a specific business membership,
   payment permission or regulated credential.

## 1. Current preview implementation / honest boundary

Interactive preview modules:
- ui-preview/dist/hustle-adaptive.js: in-memory identity/workspace capability
  model, nine service blueprints, opportunities, work records, status/version
  validation, evidence labels and permission-scoped delegation demos.
- ui-preview/dist/hustle-adaptive-ui.js / .css: adaptive hub reached from signed-in
  Profile > My Economy, Explore > Describe a need, Hustler and Agent Studio.
  Spaces, Services, Work, Requests, Team and Trust screens. Includes business
  setup and creator entry points.
- Existing BookingJourney records are mirrored idempotently into My Economy >
  Personal > Work, with a link to the original tracker. Mirror records are
  READ ONLY from the hub to prevent two conflicting lifecycle controllers.
- Other UI preview features (booking/consultation, staffed availability,
  laundry turnaround, creator/live, wallets, agents) remain intact.

Everything above uses sample data in browser memory. It does not authenticate
real workspaces, save account data, pay users, contact providers or send push.
A page reload clears the adaptive hub's new records.
The legacy mock wallet remains independent, and no real financial integration is
claimed. Do not mistake implementation of domain-shape and UX for a launched
platform.

## 2. Backend implementation boundary

Reference files:
- backend-readiness/adaptive-v1/001_schema.sql: PostgreSQL draft ONLY.
- backend-readiness/adaptive-v1/002_blueprint_seeds.sql: nine versioned blueprints.
- backend-readiness/adaptive-v1/openapi.yaml: proposed server endpoints.

These files are versioned instructions for the NEXT backend phase. They have
NOT been applied to staging or production. They cannot be treated as valid
against the project's actual database until inspected for existing schema
naming, ownership, auth and payment integrations.

### Deployment guardrails
- No production database credentials, restore workflow or migrations.
- No real client payment, escrow release, payout or provider settlement.
- No main-branch merge or Cloudflare production deployment.
- First: read-only inventory of existing migrations and auth identities.
- Next: separate disposable dev database or migration scratch branch.
- Test migrations and RLS in CI, review conflicts, backup/rehearse rollback.
- Only then request explicit founder approval before production changes.

## 3. Recommended software boundaries

**Identity and Trust**
- Existing Supabase Auth (subject to verifying actual implementation) is the
  source of signed-in user IDs.
- Verified identity, personal claims and skills are attached to a user ID;
  business verification is separate.
- Credential validation varies by occupation, jurisdiction and service risk.

**Workspace and Delegation**
- Businesses, teams and agencies are first-class workspaces.
- Founder owns one or many workspaces with separate books and audit logs.
- Worker roster entries are not automatically authenticated Hustle accounts.
- Agent invitation requires owner initiation AND invited person's direct,
  authenticated acceptance. No agent assumes identity, releases money, sets
  bank details or approves their own access.
- Revoke permissions immediately in backend token checks and future task access.

**Blueprint Configuration**
- Nine versioned types: appointment, item, project, group, event, product,
  digital, recurring and live.
- Service instantiates a blueprint, with a typed requirements schema and
  optional capabilities, rather than a new hard-coded mobile screen.
- Version the blueprint; pin its version and terms to each accepted agreement.

**Work and Finance**
- All creation surfaces (post Hire/Buy, profile, Marketplace, client Request,
  live product, apprenticeship, agent-assisted approved request) produce
  one work/order identifier and linked activities.
- Quote lines use integer minor units. Consultation credit is deducted
  exactly once, never twice or beyond applicable quote.
- Escrow, licensed custodial arrangements, payouts and ledgers must be
  designed with payment/legal review separately. NEVER model user balance
  by mutating a frontend counter or assume third-party providers hold escrow.
- Funding, client approval, release, refund and dispute require an authoritative
  server/ledger event and provider webhook idempotency.

**Resources and Scheduling**
- Resource inventory includes workers, staff skills, chairs, rooms, gear,
  vehicles, branches, buffers and leave.
- Reserve ALL needed resources/intervals atomically. A multi-person job can
  require more than one consecutive time range. Service duration can be
  individual, group/shared or batch. Do not overbook after staff departure.
- Store appointment timestamps in UTC and source IANA timezone; never
  persist ambiguous strings like "Tomorrow".
- Holds expire through a transactional sweep; server rechecks before accept.

**Discovery and Opportunities**
- Contextual search combines content, skills, service, availability, area,
  price and evidence. AI can recommend likely workflows with explanation.
- Recommendations do not assert verification, ratings or availability without
  matching trusted, fresh records.
- Private opportunity drafts never broadcast to professionals automatically.

**Work Evidence and Reputation**
- Work event history append-only and permission scoped.
- Evidence may be self-uploaded, client-confirmed or independently verified;
  preserve distinctions in UI and algorithm.
- Individual work credits and workspace reviews must never be silently merged.
- Prior worker leaves: keep original assignment and history while managers
  reassign unfinished commitments, notify customers and confirm new ETA.
- Private garment photos, body measurements, home addresses and sensitive
  documents need per-purpose consent, encrypted/private storage, retention
  limits and controlled sharing.

**Notification Engine**
- Work transitions atomically write an outbox event.
- Recipient/channel processing respects opt-in and category preferences;
  templates for off-app messages; retry, deduplicate, dead-letter and audit.
- Professional alone marks laundry "ready"; time estimates never auto-complete.
- Delivery proof is required for high-risk or disputed handovers; receipt
  confirmation and milestone release are different business actions.

## 4. Backend milestone order — complete slices, not microtasks

### Milestone A: Core Skeleton + access boundaries
- Inventory actual auth, profiles, existing services/listings and database.
- Map old roles to capabilities/workspaces (without deleting old records).
- Apply reviewed schema in isolated development DB, build typed API adapters,
  audited workspace membership and dual-consent delegation.
- Server permission integration tests for owners, client, workers and agents.
- UI switches from sample workspaces to authenticated dev data behind a flag.
**Exit:** One account can own two isolated businesses and hire as an individual.
An agent cannot see or change unrelated records.

### Milestone B: Service blueprints + universal work
- Seed nine blueprints, implement typed service policy, dynamic questions and
  listing publication with schema/semantic validation.
- Connect feed, profile, Marketplace, requests and chat to a single work ID.
- Create quotes, accepted agreement versions and work-event history.
- Implement staff/equipment resource calendar, conflict constraints, hold TTL,
  group/batch slots, cancellation/reassignment and async job timelines.
- Add private media intake, contract/evidence storage and work notifications.
**Exit:** Barber, laundry, tailor and digital creator pilots create real,
recoverable dev work orders and demonstrate cancellation/dispute flows.

### Milestone C: Economic and agency layer
- Review PSP/custody and legal obligations. Implement authoritative ledger
  or licensed-provider reference integration under a separate security gate.
- Signed payment instructions, webhook verification, reconciliation,
  idempotency, refund and milestone release approvals.
- Authorized agent work and commission reporting; never cross-tenant payouts.
- Add moderation, reviews, dispute evidence and appeal workflows.
**Exit:** No funds are represented as released until the authoritative
provider/ledger confirms them and the correct approving actor is verified.

### Milestone D: Intelligence + growth layer
- Build opportunity matching with factual filters, reason labels, opt-in
  recommendations and safe assisted setup.
- Connect social content / products / live / teaching to the same service
  and work contracts. Keep feed chrome minimal.
- Observe funnel outcomes, completion, dispute rates and no-show patterns.
- Propose workflow improvements to professionals, who approve material changes.
**Exit:** Multiple industries use the same backend and can tune their
workflows without new app-specific booking code.

## 5. Four acceptance pilots + adversarial cases

1. Barber: 4 eligible barbers, 2 physical chairs => max 2 overlapping cuts,
   not 4. Two-hour wedding group requires all resource intervals. Staff off
   or departed immediately reduces future capacity without deleting history.
2. Laundry: customer chooses home pickup and return delivery, selects an
   intake date, receives itemized transport fees, revised ready date/time
   and actual professional-triggered "ready" notification. The ready date
   cannot automatically release protected payment.
3. Tailor/shoemaker: guided video sizing versus private body/foot measurements,
   versioned fit approval, revision requests and signed pickup/delivery proof.
4. Creator: content-to-commission transition, digital brief, files, allowed
   revisions, milestones, final client acceptance and personal work evidence.

Cross-cutting:
- Multi-business isolation (no mixed clients, reviews or finances).
- Agent invited but not accepted: no access.
- Revoked agent token cannot submit service edits or mark work complete.
- Two concurrent reservations for same physical resource: exactly one wins.
- Offline retries and duplicate payment webhook: no duplicate quote/order/event.
- Old accepted quote remains unchanged after professional changes public price.
- User cannot approve their own review, release another client's milestone or
  learn private addresses from public content.
- Disputed work pauses releases without deleting evidence.
- Accessibility: voice labels, 44px tap targets, keyboard focus, low-data
  images and reduced motion.
- Monitoring: booking rejection/no-show, client completion, duplicate event
  rate, fraud reports, disputes, staff reassignment and notification delivery.

## 6. Explicit deferred decisions
- Custody/escrow legal design for Nigeria and external cross-border payments.
- Payment provider, wallet balance ledger and settlement account model.
- Business KYB/identity verification providers and high-risk skill screening.
- Logistics aggregator versus self-managed couriers.
- Background job infrastructure and notification providers.
- Exact AI feature scopes, data retention and automated action approvals.

None of these can be accurately declared "done" by adding UI toggles alone.
