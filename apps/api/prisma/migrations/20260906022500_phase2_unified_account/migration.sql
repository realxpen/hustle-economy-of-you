CREATE TYPE "Capability" AS ENUM ('CLIENT', 'HUSTLER', 'AGENT');
CREATE TYPE "CapabilityStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'REVOKED');

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "authSubject" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "phoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "displayName" TEXT,
    "username" TEXT,
    "bio" TEXT,
    "location" TEXT,
    "avatarUrl" TEXT,
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserCapability" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "capability" "Capability" NOT NULL,
    "status" "CapabilityStatus" NOT NULL DEFAULT 'ACTIVE',
    "enabledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserCapability_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_authSubject_key" ON "User"("authSubject");
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "UserCapability_userId_capability_key" ON "UserCapability"("userId", "capability");
CREATE INDEX "UserCapability_capability_status_idx" ON "UserCapability"("capability", "status");
ALTER TABLE "UserCapability" ADD CONSTRAINT "UserCapability_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Hustle clients do not access operational identity data through Supabase Data API.
-- If these tables live in Supabase's exposed public schema, RLS denies direct anon/authenticated access by default.
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserCapability" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SystemEvent" ENABLE ROW LEVEL SECURITY;
