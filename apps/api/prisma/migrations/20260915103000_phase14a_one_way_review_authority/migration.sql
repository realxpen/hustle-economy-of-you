-- Phase 14A correction — public reputation is demand-side -> provider only.
-- Booking: CLIENT -> HUSTLER
-- Order: BUYER -> SELLER

ALTER TABLE "Review"
DROP CONSTRAINT IF EXISTS "Review_role_pair";

ALTER TABLE "Review"
ADD CONSTRAINT "Review_role_pair" CHECK (
  ("reviewerRole" = 'CLIENT' AND "revieweeRole" = 'HUSTLER') OR
  ("reviewerRole" = 'BUYER' AND "revieweeRole" = 'SELLER')
);
