-- Hustle Adaptive Economy v1 / BACKEND READINESS DRAFT
-- Target: Supabase PostgreSQL 15+; requires auth.users from Supabase.
-- NOT EXECUTED. DO NOT RUN AGAINST PRODUCTION BEFORE REVIEW, BASELINE,
-- BACKUP/RESTORE REHEARSAL, ACCOUNT MIGRATION AND SECURITY SIGN-OFF.
-- Tables are isolated in an adaptive schema to avoid colliding with existing app tables.
-- No actual wallet, custody or escrow ledger is implemented here.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE SCHEMA IF NOT EXISTS adaptive;

CREATE TABLE IF NOT EXISTS adaptive.identity_capabilities (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  capability text NOT NULL CHECK (capability IN ('hire','offer','sell','create','teach','manage','represent','learn')),
  enabled_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,capability)
);

CREATE TABLE IF NOT EXISTS adaptive.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id),
  kind text NOT NULL CHECK (kind IN ('personal','business','team','agency')),
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 120),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{2,80}$'),
  category text, city text,
  verification_status text NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified','pending','verified','suspended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  version bigint NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS adaptive.workspace_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES adaptive.workspaces(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner','manager','worker','agent','accountant','assistant')),
  status text NOT NULL DEFAULT 'invited'
    CHECK (status IN ('invited','accepted','revoked','expired')),
  permissions text[] NOT NULL DEFAULT '{}',
  invited_by uuid NOT NULL REFERENCES auth.users(id),
  accepted_at timestamptz,
  revoked_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT accepted_has_consent CHECK (status <> 'accepted' OR accepted_at IS NOT NULL),
  UNIQUE(workspace_id,user_id)
);
CREATE INDEX IF NOT EXISTS membership_by_person
  ON adaptive.workspace_memberships(user_id,status);

CREATE TABLE IF NOT EXISTS adaptive.delegation_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES adaptive.workspaces(id),
  inviting_user_id uuid NOT NULL REFERENCES auth.users(id),
  invited_user_id uuid REFERENCES auth.users(id),
  invite_contact_hash bytea,
  requested_role text NOT NULL CHECK (requested_role IN ('agent','assistant','manager','worker','accountant')),
  requested_permissions text[] NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','declined','revoked','expired')),
  consented_by uuid REFERENCES auth.users(id),
  consented_at timestamptz,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT delegation_acceptance CHECK (
    status <> 'accepted' OR
    (consented_by = invited_user_id AND consented_at IS NOT NULL)
  )
);
-- Server must reject sensitive delegated capabilities:
-- wallet.withdraw, payout.change, escrow.release, identity.approve,
-- delegate.grant and any wildcard '*'.

CREATE TABLE IF NOT EXISTS adaptive.service_blueprints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL CHECK (slug ~ '^[a-z0-9-]+$'),
  version integer NOT NULL CHECK(version > 0),
  type text NOT NULL CHECK (type IN (
    'appointment','item','project','group','event','product','digital','recurring','live')),
  definition jsonb NOT NULL CHECK (jsonb_typeof(definition)='object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  UNIQUE(slug,version)
);
-- Never overwrite a published blueprint version. Snapshot it into signed orders.

CREATE TABLE IF NOT EXISTS adaptive.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES adaptive.workspaces(id),
  blueprint_id uuid NOT NULL REFERENCES adaptive.service_blueprints(id),
  title text NOT NULL CHECK(char_length(title) BETWEEN 3 AND 150),
  summary text,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','published','paused','archived')),
  category text NOT NULL,
  location_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  requirements_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  base_price_minor bigint NOT NULL DEFAULT 0 CHECK(base_price_minor >= 0),
  currency char(3) NOT NULL DEFAULT 'NGN',
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS services_workspace ON adaptive.services(workspace_id,status);

CREATE TABLE IF NOT EXISTS adaptive.business_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES adaptive.workspaces(id),
  name text NOT NULL,
  public_area text,
  private_address_ciphertext bytea,
  timezone text NOT NULL DEFAULT 'Africa/Lagos',
  opening_hours jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS adaptive.workers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES adaptive.workspaces(id),
  user_id uuid REFERENCES auth.users(id),
  display_name text NOT NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK(status IN ('active','leave','departed')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  departed_at timestamptz,
  UNIQUE(workspace_id,user_id)
);
-- Workers without a linked user_id are roster entries only, NEVER authenticated principals.

CREATE TABLE IF NOT EXISTS adaptive.resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES adaptive.workspaces(id),
  location_id uuid REFERENCES adaptive.business_locations(id),
  worker_id uuid REFERENCES adaptive.workers(id),
  kind text NOT NULL CHECK(kind IN ('worker','chair','room','equipment','vehicle','other')),
  label text NOT NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK(status IN ('active','unavailable','retired')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS resources_by_workspace ON adaptive.resources(workspace_id,kind);

CREATE TABLE IF NOT EXISTS adaptive.opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  workspace_id uuid REFERENCES adaptive.workspaces(id),
  title text NOT NULL CHECK(char_length(title) BETWEEN 5 AND 200),
  description text NOT NULL,
  category text,
  budget_minor bigint CHECK(budget_minor >= 0),
  currency char(3) NOT NULL DEFAULT 'NGN',
  public_area text,
  requirements jsonb NOT NULL DEFAULT '{}'::jsonb,
  visibility text NOT NULL DEFAULT 'private'
    CHECK(visibility IN ('private','invited','public')),
  status text NOT NULL DEFAULT 'draft'
    CHECK(status IN ('draft','open','shortlisted','closed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS adaptive.opportunity_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES adaptive.opportunities(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES adaptive.services(id),
  reasoning jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'suggested'
    CHECK(status IN ('suggested','contacted','declined','accepted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(opportunity_id,service_id)
);

CREATE TABLE IF NOT EXISTS adaptive.work_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES adaptive.workspaces(id),
  service_id uuid REFERENCES adaptive.services(id),
  opportunity_id uuid REFERENCES adaptive.opportunities(id),
  client_user_id uuid NOT NULL REFERENCES auth.users(id),
  created_by_user_id uuid NOT NULL REFERENCES auth.users(id),
  blueprint_type text NOT NULL,
  status text NOT NULL DEFAULT 'requested'
    CHECK(status IN (
      'requested','awaiting_approval','accepted','in_progress','ready',
      'out_for_delivery','delivered','review','completed','disputed','cancelled','declined')),
  title text NOT NULL,
  requirements jsonb NOT NULL DEFAULT '{}'::jsonb,
  handover_terms jsonb NOT NULL DEFAULT '{}'::jsonb,
  signed_agreement_snapshot jsonb,
  agreement_version integer NOT NULL DEFAULT 0,
  due_at timestamptz,
  estimated_ready_at timestamptz,
  completed_at timestamptz,
  version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS work_order_workspace_status ON adaptive.work_orders(workspace_id,status);
CREATE INDEX IF NOT EXISTS work_order_client ON adaptive.work_orders(client_user_id,created_at DESC);

CREATE TABLE IF NOT EXISTS adaptive.work_participants (
  work_order_id uuid NOT NULL REFERENCES adaptive.work_orders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  participation_role text NOT NULL CHECK (participation_role IN
    ('client','professional','assigned_worker','agent','approver','observer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(work_order_id,user_id,participation_role)
);

CREATE TABLE IF NOT EXISTS adaptive.resource_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid NOT NULL REFERENCES adaptive.resources(id),
  work_order_id uuid NOT NULL REFERENCES adaptive.work_orders(id),
  period tstzrange NOT NULL,
  status text NOT NULL DEFAULT 'held'
    CHECK(status IN ('held','confirmed','released','cancelled')),
  hold_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_booking_period CHECK (NOT isempty(period)),
  CONSTRAINT held_has_expiry CHECK (status <> 'held' OR hold_expires_at IS NOT NULL),
  CONSTRAINT no_resource_overlap EXCLUDE USING gist
    (resource_id WITH =, period WITH &&)
    WHERE (status IN ('held','confirmed'))
);
-- Important: expired held rows still overlap until the server releases them.
-- Reserve group resources in ONE transaction after locking all needed resources;
-- confirm/release with version checks. Never rely on client-reported availability.

CREATE TABLE IF NOT EXISTS adaptive.work_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES adaptive.work_orders(id),
  worker_id uuid REFERENCES adaptive.workers(id),
  membership_id uuid REFERENCES adaptive.workspace_memberships(id),
  assigned_by uuid NOT NULL REFERENCES auth.users(id),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  CHECK(worker_id IS NOT NULL OR membership_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS adaptive.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES adaptive.work_orders(id),
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL DEFAULT 'draft'
    CHECK(status IN ('draft','offered','accepted','declined','expired','superseded')),
  currency char(3) NOT NULL DEFAULT 'NGN',
  total_minor bigint NOT NULL CHECK(total_minor >= 0),
  consultation_credit_minor bigint NOT NULL DEFAULT 0 CHECK(consultation_credit_minor >= 0),
  terms jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz,
  accepted_by uuid REFERENCES auth.users(id),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(work_order_id,version),
  CONSTRAINT accepted_quote_identity CHECK (status <> 'accepted' OR (accepted_by IS NOT NULL AND accepted_at IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS adaptive.quote_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES adaptive.quotes(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK(kind IN ('service','materials','travel','collection','delivery','fitting','event','discount','tax','other')),
  description text NOT NULL,
  quantity numeric(12,3) NOT NULL CHECK(quantity > 0),
  unit_minor bigint NOT NULL CHECK(unit_minor >= 0),
  line_minor bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Server validates quote_lines sum and consultation-credit eligibility exactly once.

CREATE TABLE IF NOT EXISTS adaptive.work_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES adaptive.work_orders(id),
  actor_user_id uuid REFERENCES auth.users(id),
  actor_workspace_id uuid REFERENCES adaptive.workspaces(id),
  event_type text NOT NULL,
  from_status text,
  to_status text,
  version bigint NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(work_order_id,version)
);
-- Append-only, server-authored. Clients must NOT update or delete history.

CREATE TABLE IF NOT EXISTS adaptive.work_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES adaptive.work_orders(id),
  submitted_by uuid NOT NULL REFERENCES auth.users(id),
  storage_key text NOT NULL,
  evidence_type text NOT NULL CHECK(evidence_type IN ('photo','video','document','receipt','signed_handover','review')),
  status text NOT NULL DEFAULT 'submitted'
    CHECK(status IN ('submitted','client_confirmed','disputed','retracted')),
  permission_to_publish boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Photos, measurements and private addresses live in protected storage, not public feeds.

CREATE TABLE IF NOT EXISTS adaptive.work_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES adaptive.work_orders(id),
  reviewer_user_id uuid NOT NULL REFERENCES auth.users(id),
  subject_user_id uuid REFERENCES auth.users(id),
  subject_workspace_id uuid REFERENCES adaptive.workspaces(id),
  rating smallint NOT NULL CHECK(rating BETWEEN 1 AND 5),
  review_text text,
  verification_level text NOT NULL DEFAULT 'work_confirmed'
    CHECK(verification_level IN ('unverified','work_confirmed','independently_verified')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((subject_user_id IS NULL) <> (subject_workspace_id IS NULL))
);

CREATE TABLE IF NOT EXISTS adaptive.work_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES adaptive.work_orders(id),
  raised_by uuid NOT NULL REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'open'
    CHECK(status IN ('open','under_review','resolved','appealed','closed')),
  reason text NOT NULL,
  resolution_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE TABLE IF NOT EXISTS adaptive.payment_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES adaptive.work_orders(id),
  external_provider text NOT NULL,
  external_reference text NOT NULL,
  intent_type text NOT NULL CHECK(intent_type IN ('consultation','booking','milestone','refund','payout')),
  status text NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending','confirmed','failed','reversed','cancelled')),
  amount_minor bigint NOT NULL CHECK(amount_minor >= 0),
  currency char(3) NOT NULL DEFAULT 'NGN',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(external_provider,external_reference)
);
-- This is a reference table, NOT a wallet balance or custody system.

CREATE TABLE IF NOT EXISTS adaptive.notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  categories jsonb NOT NULL DEFAULT '{}'::jsonb,
  channels jsonb NOT NULL DEFAULT '{"in_app":true,"push":false,"sms":false,"email":false}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS adaptive.event_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  event_name text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key text NOT NULL UNIQUE,
  state text NOT NULL DEFAULT 'pending'
    CHECK(state IN ('pending','processing','delivered','failed','dead_letter')),
  attempts integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz
);
CREATE INDEX IF NOT EXISTS outbox_ready
  ON adaptive.event_outbox(state,available_at)
  WHERE state IN ('pending','failed');

CREATE TABLE IF NOT EXISTS adaptive.api_idempotency (
  workspace_id uuid NOT NULL REFERENCES adaptive.workspaces(id),
  actor_user_id uuid NOT NULL REFERENCES auth.users(id),
  operation text NOT NULL,
  request_key text NOT NULL,
  request_hash text NOT NULL,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(workspace_id,actor_user_id,operation,request_key)
);
CREATE TABLE IF NOT EXISTS adaptive.security_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES auth.users(id),
  workspace_id uuid REFERENCES adaptive.workspaces(id),
  action text NOT NULL,
  target_type text NOT NULL,
  target_id uuid,
  previous_hash text,
  change_hash text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Deny direct browser access by default; all writes go via reviewed, authorized backend.
DO $$
DECLARE t text;
BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='adaptive' LOOP
  EXECUTE format('ALTER TABLE adaptive.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON TABLE adaptive.%I FROM anon, authenticated',t);
 END LOOP;
END $$;
REVOKE ALL ON SCHEMA adaptive FROM anon, authenticated;
-- Service-role API must separately verify:
-- 1. logged-in principal / workspace membership / consent / delegated scope
-- 2. booking resources and optimistic work_order.version in one transaction
-- 3. quote version + customer acceptance before payment intent
-- 4. server-verified payment provider webhooks; idempotency and outbox writes
-- 5. user-authorized data access, media visibility, retention and audit events
COMMIT;
