# Hustle Project State

Updated: 2026-09-08

## Current AED capability
Build

## Current MVP phase
Phase 4 — Professional Profile + Digital Identity

## Phase 1 status
COMPLETE.

Foundation validated: approved monorepo, NestJS modular API, Prisma/PostgreSQL, Next.js web/admin, Expo mobile and provider boundaries.

## Phase 2 status
COMPLETE.

Validated operational identity loop:

`Register → verify → synchronize → CLIENT → complete profile → sign out → sign back in → retain the same Hustle identity.`

Rules now proven:
- one provider identity maps to one Hustle `User`
- every synchronized user receives CLIENT automatically
- HUSTLER and AGENT are additive capabilities
- no role switcher and no separate account modes
- Supabase Auth remains behind `AuthPort`
- `UserCapability` is authorization truth

## Phase 3 status
COMPLETE.

The full real gate was exercised successfully on 2026-09-08:

`CLIENT → Hustler application → draft → private proof → submit → SUBMITTED → second verified reviewer → UNDER_REVIEW → proof inspection → identity VERIFIED → APPROVED → same User retains CLIENT ACTIVE + receives HUSTLER ACTIVE`

Hosted database verification after the gate confirms:
- Hustler application: APPROVED
- identity verification: VERIFIED
- CLIENT: ACTIVE
- HUSTLER: ACTIVE

### Phase 3 implementation
Applicant API:
- `GET /api/v1/hustler-application`
- `PUT /api/v1/hustler-application`
- `POST /api/v1/hustler-application/proofs`
- `DELETE /api/v1/hustler-application/proofs/:proofId`
- `POST /api/v1/hustler-application/submit`

Review API:
- `GET /api/v1/hustler-reviews`
- `GET /api/v1/hustler-reviews/:applicationId`
- `POST /api/v1/hustler-reviews/:applicationId/start`
- `POST /api/v1/hustler-reviews/:applicationId/verification`
- `POST /api/v1/hustler-reviews/:applicationId/proofs/:proofId/read-url`
- `POST /api/v1/hustler-reviews/:applicationId/approve`
- `POST /api/v1/hustler-reviews/:applicationId/reject`

Validated protections:
- applicant owns only their application
- applicant cannot self-approve
- reviewer must be an allow-listed verified second identity
- proof storage is private
- identity must be VERIFIED before approval
- approval is atomic
- ACTIVE CLIENT is preserved
- HUSTLER is added to the same User
- no role switcher

Temporary Phase 3 review surface:
- `/internal/hustler-reviews`

Full Admin + Operations remains Phase 19.

## Supabase
Dedicated Hustle project:
- Name: `hustle-economy of you`
- Ref: `pfgarmyygybmhiiuopym`
- Region: `eu-west-1`
- API URL: `https://pfgarmyygybmhiiuopym.supabase.co`

Applied hosted migrations:
- `phase1_foundation`
- `phase2_unified_account`
- `api_database_role`
- `phase3_hustler_application_foundation`
- `phase3_hustler_proof_storage`

Phase 3 hosted foundation:
- `HustlerApplication`
- `HustlerApplicationProof`
- private `hustler-proofs` bucket
- authenticated identity-bound storage policies
- 10 MB proof limit
- PDF/JPEG/PNG/WebP proof formats

RLS remains enabled. `hustle_api` remains the API-side database actor.

Security advisor after Phase 3 found no new database/storage policy problem. Remaining account-level warning: Supabase leaked-password protection is disabled.

## Local development
- Web: `http://localhost:3001`
- API: `http://localhost:4000/api/v1`
- Admin reserved: `http://localhost:3002`
- Auth/database/storage: hosted Hustle Supabase
- Local Prisma connection: Supabase Session Pooler on port 5432

Secrets and `.env` files remain local and must never be committed.

## Repository workflow
ChatGPT may implement and commit directly to `realxpen/hustle-economy-of-you` when continuing project work. The project owner pulls and tests locally. Never commit secrets or private environment values.

## Current Phase 4 objective
Turn HUSTLER ACTIVE into a professional digital identity that can be edited, published and viewed by another person.

Canonical Phase 4 path:

`HUSTLER ACTIVE → bootstrap professional profile → edit → publish → public visitor profile`

## Phase 4 identity rule
The professional profile extends the existing User. It does not create another account, role mode or authorization source.

Universal identity stays on `User`:
- display name
- username
- avatar
- bio
- location
- verification/capabilities

Professional presentation adds Hustler-specific fields:
- headline
- cover
- primary skill
- secondary skills
- category
- professional summary
- years of experience
- publication state

Initial professional values should be bootstrapped from the approved Hustler application where sensible. Editing the professional profile must never rewrite the approved application/review evidence.

## Phase 4 planned slices

### Phase 4A — Professional profile data foundation
- Prisma model + hosted migration
- HUSTLER ACTIVE authorization
- bootstrap from approved application
- DRAFT / PUBLISHED state

### Phase 4B — Owner profile API
- get own professional profile
- update professional profile
- publish/unpublish

### Phase 4C — Owner editing experience
- profile editor
- cover/avatar presentation
- headline
- primary + secondary skills
- category
- professional summary
- years experience
- public preview

### Phase 4D — Public visitor profile
- stable username route `/u/[username]`
- only PUBLISHED profiles resolve publicly
- same User identity and HUSTLER capability shown

Later phases attach services, products, content, reviews and storefront commerce to this same profile rather than inventing duplicate profile systems.

## Phase 4 gate
A real approved Hustler must be able to:

`HUSTLER ACTIVE → professional profile created → edit identity → publish → open /u/[username] as a visitor → see the same identity and professional capability`

CLIENT remains ACTIVE. No role switcher.

## Next phase after Phase 4 gate
Phase 5 — Services.
