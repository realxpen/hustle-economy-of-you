-- Phase 14D-C2: separate safety-report context from public-review subject type.
-- Existing BOOKING / ORDER rows cast losslessly into the wider report-context enum.

CREATE TYPE "SafetyReportSubjectType" AS ENUM ('BOOKING', 'ORDER', 'PROFILE', 'CONVERSATION');

ALTER TABLE "SafetyReport"
  ALTER COLUMN "subjectType" TYPE "SafetyReportSubjectType"
  USING ("subjectType"::text::"SafetyReportSubjectType");
