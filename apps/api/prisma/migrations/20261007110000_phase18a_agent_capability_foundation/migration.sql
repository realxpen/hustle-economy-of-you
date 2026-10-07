CREATE TYPE "AgentApplicationStatus" AS ENUM (
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'SUSPENDED'
);

CREATE TYPE "AgentProofType" AS ENUM (
  'IDENTITY_DOCUMENT',
  'BUSINESS_DOCUMENT',
  'COMMUNITY_REFERENCE',
  'OTHER'
);

CREATE TABLE "AgentApplication" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "AgentApplicationStatus" NOT NULL DEFAULT 'DRAFT',
  "motivation" TEXT,
  "experienceSummary" TEXT,
  "operatingArea" TEXT,
  "organizationName" TEXT,
  "organizationInfo" TEXT,
  "identityVerificationStatus" "VerificationStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "submittedAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "reviewerId" TEXT,
  "reviewNotes" TEXT,
  "rejectionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AgentApplication_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgentApplicationProof" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "type" "AgentProofType" NOT NULL,
  "storageKey" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentApplicationProof_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AgentApplication_userId_key"
ON "AgentApplication"("userId");

CREATE INDEX "AgentApplication_status_idx"
ON "AgentApplication"("status");

CREATE INDEX "AgentApplication_operatingArea_idx"
ON "AgentApplication"("operatingArea");

CREATE UNIQUE INDEX "AgentApplicationProof_storageKey_key"
ON "AgentApplicationProof"("storageKey");

CREATE INDEX "AgentApplicationProof_applicationId_type_idx"
ON "AgentApplicationProof"("applicationId", "type");

ALTER TABLE "AgentApplication"
ADD CONSTRAINT "AgentApplication_userId_fkey"
FOREIGN KEY ("userId")
REFERENCES "User"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "AgentApplication"
ADD CONSTRAINT "AgentApplication_reviewerId_fkey"
FOREIGN KEY ("reviewerId")
REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "AgentApplicationProof"
ADD CONSTRAINT "AgentApplicationProof_applicationId_fkey"
FOREIGN KEY ("applicationId")
REFERENCES "AgentApplication"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "AgentApplication" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AgentApplicationProof" ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE "AgentApplication", "AgentApplicationProof"
TO hustle_api;

CREATE POLICY hustle_api_agent_application_all
ON "AgentApplication"
FOR ALL
TO hustle_api
USING (true)
WITH CHECK (true);

CREATE POLICY hustle_api_agent_application_proof_all
ON "AgentApplicationProof"
FOR ALL
TO hustle_api
USING (true)
WITH CHECK (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'agent-proofs',
  'agent-proofs',
  false,
  10485760,
  array['application/pdf','image/jpeg','image/png','image/webp']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists agent_proofs_insert_own on storage.objects;
drop policy if exists agent_proofs_select_own on storage.objects;
drop policy if exists agent_proofs_delete_own on storage.objects;

create policy agent_proofs_insert_own
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'agent-proofs'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy agent_proofs_select_own
on storage.objects
for select
to authenticated
using (
  bucket_id = 'agent-proofs'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy agent_proofs_delete_own
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'agent-proofs'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
