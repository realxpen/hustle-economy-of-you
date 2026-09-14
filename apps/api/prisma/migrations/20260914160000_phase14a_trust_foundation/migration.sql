-- Phase 14A — Trust + Reputation foundation

CREATE TYPE "ReviewSubjectType" AS ENUM ('BOOKING', 'ORDER');
CREATE TYPE "ReviewPartyRole" AS ENUM ('CLIENT', 'HUSTLER', 'BUYER', 'SELLER');
CREATE TYPE "ReviewStatus" AS ENUM ('PUBLISHED', 'HIDDEN', 'REMOVED');

CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "subjectType" "ReviewSubjectType" NOT NULL,
    "subjectId" TEXT NOT NULL,
    "reviewerUserId" TEXT NOT NULL,
    "revieweeUserId" TEXT NOT NULL,
    "reviewerRole" "ReviewPartyRole" NOT NULL,
    "revieweeRole" "ReviewPartyRole" NOT NULL,
    "rating" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PUBLISHED',
    "verifiedTransaction" BOOLEAN NOT NULL DEFAULT true,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "moderationReason" TEXT,
    "hiddenAt" TIMESTAMP(3),
    "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Review_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Review_rating_range" CHECK ("rating" BETWEEN 1 AND 5),
    CONSTRAINT "Review_body_length" CHECK (char_length("body") BETWEEN 10 AND 2000),
    CONSTRAINT "Review_no_self_review" CHECK ("reviewerUserId" <> "revieweeUserId"),
    CONSTRAINT "Review_verified_transaction_only" CHECK ("verifiedTransaction" = true),
    CONSTRAINT "Review_role_pair" CHECK (
      ("reviewerRole" = 'CLIENT' AND "revieweeRole" = 'HUSTLER') OR
      ("reviewerRole" = 'HUSTLER' AND "revieweeRole" = 'CLIENT') OR
      ("reviewerRole" = 'BUYER' AND "revieweeRole" = 'SELLER') OR
      ("reviewerRole" = 'SELLER' AND "revieweeRole" = 'BUYER')
    )
);

CREATE TABLE "UserReputation" (
    "userId" TEXT NOT NULL,
    "ratingSum" INTEGER NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "verifiedReviewCount" INTEGER NOT NULL DEFAULT 0,
    "bookingReviewCount" INTEGER NOT NULL DEFAULT 0,
    "orderReviewCount" INTEGER NOT NULL DEFAULT 0,
    "lastReviewAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserReputation_pkey" PRIMARY KEY ("userId"),
    CONSTRAINT "UserReputation_rating_sum_nonnegative" CHECK ("ratingSum" >= 0),
    CONSTRAINT "UserReputation_review_count_nonnegative" CHECK ("reviewCount" >= 0),
    CONSTRAINT "UserReputation_verified_count_nonnegative" CHECK ("verifiedReviewCount" >= 0),
    CONSTRAINT "UserReputation_booking_count_nonnegative" CHECK ("bookingReviewCount" >= 0),
    CONSTRAINT "UserReputation_order_count_nonnegative" CHECK ("orderReviewCount" >= 0),
    CONSTRAINT "UserReputation_count_consistency" CHECK ("bookingReviewCount" + "orderReviewCount" = "reviewCount"),
    CONSTRAINT "UserReputation_verified_consistency" CHECK ("verifiedReviewCount" <= "reviewCount")
);

CREATE UNIQUE INDEX "Review_subjectType_subjectId_reviewerUserId_key"
ON "Review"("subjectType", "subjectId", "reviewerUserId");

CREATE INDEX "Review_revieweeUserId_status_createdAt_idx"
ON "Review"("revieweeUserId", "status", "createdAt");

CREATE INDEX "Review_reviewerUserId_createdAt_idx"
ON "Review"("reviewerUserId", "createdAt");

CREATE INDEX "Review_subjectType_subjectId_idx"
ON "Review"("subjectType", "subjectId");

CREATE INDEX "Review_status_createdAt_idx"
ON "Review"("status", "createdAt");

ALTER TABLE "Review"
ADD CONSTRAINT "Review_reviewerUserId_fkey"
FOREIGN KEY ("reviewerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Review"
ADD CONSTRAINT "Review_revieweeUserId_fkey"
FOREIGN KEY ("revieweeUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "UserReputation"
ADD CONSTRAINT "UserReputation_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Review" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserReputation" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_api_role"
ON "Review" FOR ALL TO hustle_api USING (true) WITH CHECK (true);

CREATE POLICY "user_reputation_api_role"
ON "UserReputation" FOR ALL TO hustle_api USING (true) WITH CHECK (true);
