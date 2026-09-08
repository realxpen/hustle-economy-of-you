CREATE TYPE "HustlerApplicationStatus" AS ENUM (
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'SUSPENDED'
);

CREATE TYPE "VerificationStatus" AS ENUM (
  'NOT_STARTED',
  'PENDING',
  'VERIFIED',
  'REJECTED'
);

CREATE TYPE "HustlerProofType" AS ENUM (
  'PORTFOLIO',
  'IDENTITY_DOCUMENT',
  'CERTIFICATE',
  'BUSINESS_DOCUMENT',
  'OTHER'
);

CREATE TABLE "HustlerApplication" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "HustlerApplicationStatus" NOT NULL DEFAULT 'DRAFT',
  "primarySkill" TEXT,
  "category" TEXT,
  "experienceSummary" TEXT,
  "yearsExperience" INTEGER,
  "businessName" TEXT,
  "businessInfo" TEXT,
  "identityVerificationStatus" "VerificationStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "submittedAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "reviewerId" TEXT,
  "reviewNotes" TEXT,
  "rejectionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HustlerApplication_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HustlerApplicationProof" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "type" "HustlerProofType" NOT NULL,
  "storageKey" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HustlerApplicationProof_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HustlerApplication_userId_key"
ON "HustlerApplication"("userId");

CREATE INDEX "HustlerApplication_status_idx"
ON "HustlerApplication"("status");

CREATE INDEX "HustlerApplication_category_idx"
ON "HustlerApplication"("category");

CREATE UNIQUE INDEX "HustlerApplicationProof_storageKey_key"
ON "HustlerApplicationProof"("storageKey");

CREATE INDEX "HustlerApplicationProof_applicationId_type_idx"
ON "HustlerApplicationProof"("applicationId", "type");

ALTER TABLE "HustlerApplication"
ADD CONSTRAINT "HustlerApplication_userId_fkey"
FOREIGN KEY ("userId")
REFERENCES "User"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "HustlerApplication"
ADD CONSTRAINT "HustlerApplication_reviewerId_fkey"
FOREIGN KEY ("reviewerId")
REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "HustlerApplicationProof"
ADD CONSTRAINT "HustlerApplicationProof_applicationId_fkey"
FOREIGN KEY ("applicationId")
REFERENCES "HustlerApplication"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "HustlerApplication" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "HustlerApplicationProof" ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE "HustlerApplication", "HustlerApplicationProof"
TO hustle_api;

CREATE POLICY hustle_api_hustler_application_all
ON "HustlerApplication"
FOR ALL
TO hustle_api
USING (true)
WITH CHECK (true);

CREATE POLICY hustle_api_hustler_application_proof_all
ON "HustlerApplicationProof"
FOR ALL
TO hustle_api
USING (true)
WITH CHECK (true);
