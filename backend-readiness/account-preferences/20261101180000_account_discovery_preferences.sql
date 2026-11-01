-- Additive account discovery preferences for approved V1 onboarding.
-- PRIMARY SKILL != personal discovery interests. Neither grants HUSTLER access.
-- Store only a coarse manually selected area in User.location (existing field).
-- Deliberately no location coordinates, GPS trail, raw address, payment or escrow data.
-- DO NOT apply automatically to production or the Neon parent branch.
ALTER TABLE "User"
  ADD COLUMN "primarySkill" TEXT,
  ADD COLUMN "interests" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
