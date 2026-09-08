CREATE TYPE "ProfessionalProfileStatus" AS ENUM ('DRAFT', 'PUBLISHED');

CREATE TABLE "ProfessionalProfile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "headline" TEXT,
  "coverUrl" TEXT,
  "primarySkill" TEXT,
  "secondarySkills" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "category" TEXT,
  "professionalSummary" TEXT,
  "yearsExperience" INTEGER,
  "status" "ProfessionalProfileStatus" NOT NULL DEFAULT 'DRAFT',
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProfessionalProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProfessionalProfile_userId_key" ON "ProfessionalProfile"("userId");
CREATE INDEX "ProfessionalProfile_status_idx" ON "ProfessionalProfile"("status");
CREATE INDEX "ProfessionalProfile_category_idx" ON "ProfessionalProfile"("category");

ALTER TABLE "ProfessionalProfile"
ADD CONSTRAINT "ProfessionalProfile_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProfessionalProfile" ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "ProfessionalProfile" TO hustle_api;

CREATE POLICY hustle_api_professional_profile_all
ON "ProfessionalProfile"
FOR ALL
TO hustle_api
USING (true)
WITH CHECK (true);
