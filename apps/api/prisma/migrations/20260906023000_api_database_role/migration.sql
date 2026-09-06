-- Trusted server-side database role for the Hustle API.
-- The login password is intentionally configured out-of-band and must never be committed.
CREATE ROLE hustle_api LOGIN;

GRANT USAGE ON SCHEMA public TO hustle_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "SystemEvent", "User", "UserCapability" TO hustle_api;

-- Operational identity data is API-owned. These policies grant only the dedicated
-- server role access; anon/authenticated Supabase Data API roles remain denied.
CREATE POLICY hustle_api_system_event_all
ON "SystemEvent"
FOR ALL
TO hustle_api
USING (true)
WITH CHECK (true);

CREATE POLICY hustle_api_user_all
ON "User"
FOR ALL
TO hustle_api
USING (true)
WITH CHECK (true);

CREATE POLICY hustle_api_user_capability_all
ON "UserCapability"
FOR ALL
TO hustle_api
USING (true)
WITH CHECK (true);
