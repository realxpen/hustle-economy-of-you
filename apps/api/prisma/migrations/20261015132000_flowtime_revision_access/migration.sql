-- FlowTime API-only schedule revision access.
-- Runs AFTER 20261015122500_flowtime_adaptive_booking.
-- Never expose clients' booking schedules through Supabase browser roles.
ALTER TABLE public."BookingScheduleRevision" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."BookingScheduleRevision"
  FROM PUBLIC, anon, authenticated;

-- Prisma create() returns the new revision; SELECT is therefore also necessary.
GRANT SELECT, INSERT ON TABLE public."BookingScheduleRevision" TO hustle_api;

CREATE POLICY hustle_api_flowtime_revision_read
  ON public."BookingScheduleRevision"
  FOR SELECT TO hustle_api USING (true);
CREATE POLICY hustle_api_flowtime_revision_insert
  ON public."BookingScheduleRevision"
  FOR INSERT TO hustle_api WITH CHECK (true);
