# Hustle Project State

Updated: 2026-09-08

## Current AED capability
Build

## Current MVP phase
Phase 3 — Hustler Application + Verification

## Phase 1 status
Foundation complete and validated. Hustle uses the approved monorepo, NestJS modular API, Prisma/PostgreSQL, Next.js web/admin, Expo mobile and provider boundaries.

## Phase 2 status
COMPLETE.

The real operational identity loop has been exercised successfully:

`Register → verify → synchronize → CLIENT → complete profile → sign out → sign back in → retain the same Hustle identity.`

Validated rules:
- One provider identity maps to one Hustle `User`.
- Every synchronized user receives CLIENT automatically.
- HUSTLER and AGENT are additive capabilities.
- No role switcher and no separate account modes.
- Supabase Auth remains behind `AuthPort`.
- `UserCapability` in the Hustle database is authorization truth.

## Supabase
Dedicated project:
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

Phase 3 database/storage foundation:
- `HustlerApplication`
- `HustlerApplicationProof`
- private `hustler-proofs` storage bucket
- authenticated per-identity upload/read/delete policies
- 10 MB proof limit
- PDF/JPEG/PNG/WebP proof formats

RLS is enabled and the dedicated `hustle_api` database role remains the API-side database actor. Storage access is private and constrained by the authenticated Supabase identity path.

## Local development
Current local preview:
- Web: `http://localhost:3001`
- API: `http://localhost:4000/api/v1`
- Auth/database/storage: hosted Hustle Supabase project
- Local Prisma connection: Supabase Session Pooler on port 5432

Secrets and `.env` files remain local and must never be committed.

## Repository workflow
ChatGPT may implement and commit directly to `realxpen/hustle-economy-of-you` when the project owner asks to continue repository work. The project owner pulls and tests locally. Do not commit secrets or private environment values.

## Phase 3 invariant
HUSTLER can only be granted through the approved application/review lifecycle.

Approval must preserve CLIENT and add HUSTLER to the same User. Frontend state must never grant the capability directly.

## Phase 3 implementation status

### Phase 3A — Application API
Implemented:
- `GET /api/v1/hustler-application`
- `PUT /api/v1/hustler-application`
- `POST /api/v1/hustler-application/proofs`
- `DELETE /api/v1/hustler-application/proofs/:proofId`
- `POST /api/v1/hustler-application/submit`
- authenticated ownership
- draft-only editing and proof mutation
- required-field validation
- proof requirement before submission
- proof metadata validation and identity-bound storage keys

### Phase 3B — Applicant experience
Implemented:
- account CTA: Apply to become a Hustler
- dedicated Hustler application route
- skill/category fields
- experience and years-of-experience fields
- optional business context
- draft persistence
- private proof upload/removal
- application progress and lifecycle state
- submission to review once required fields and proof are present

### Phase 3C — Proof storage
ACTIVE.

Private Supabase Storage is enabled for Hustler proof files. Browser uploads use the authenticated session and per-user path RLS; the API records proof metadata only for the same authenticated identity.

Security advisor after activation reports no new database/storage policy findings. The remaining warning is the account-level Supabase Auth leaked-password-protection setting.

## Next Phase 3 slice
Build the minimal review/approval operation and admin review surface. Approval must be atomic: application APPROVED + `UserCapability(HUSTLER, ACTIVE)` in one database transaction.

## Phase 3 gate
A real Client must be able to:

`Create application → add skill/category/experience/proof → submit → review → approval → retain CLIENT + receive HUSTLER`

No second account. No role switcher.

## Next phase after Phase 3 gate
Phase 4 — Professional Profile + Digital Identity.
