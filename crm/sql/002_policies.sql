/*
  002_policies.sql
  Purpose: Idempotent GRANT/REVOKE for runtime roles and basic RLS toggles (if applicable).
  Assumptions:
    - Schema: public
    - Roles:
        app_admin: migration/DDL
        app_user: runtime (no DELETE/DDL)
        readonly: SELECT-only analytics
    - Tables (from 001_crm_schema.sql + helpers):
        contacts, companies, deals, pipelines, pipeline_stages, activities, owners, webhooks_log (or webhooks_log_dev in dev)
    - RLS policies may be defined elsewhere; this file focuses on permissions and safe defaults.
*/

-- Ensure roles exist (idempotent pattern): CREATE ROLE will fail if exists; wrap in DO blocks if needed at migration layer.
-- This file assumes roles are already created as per STAGING_ROLLOUT.md.

-- Optional: enable RLS (if not already managed in 001 or separate policies file)
-- ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
-- ... (other tables)

-- REVOKE broad privileges from public (safety)
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC;

-- Grant minimal schema usage
GRANT USAGE ON SCHEMA public TO app_user, readonly;

-- Readonly: SELECT-only on data tables
GRANT SELECT ON TABLE public.contacts TO readonly;
GRANT SELECT ON TABLE public.companies TO readonly;
GRANT SELECT ON TABLE public.deals TO readonly;
GRANT SELECT ON TABLE public.pipelines TO readonly;
GRANT SELECT ON TABLE public.pipeline_stages TO readonly;
GRANT SELECT ON TABLE public.activities TO readonly;
GRANT SELECT ON TABLE public.owners TO readonly;
-- webhooks_log usually not required for analytics; grant if needed:
-- GRANT SELECT ON TABLE public.webhooks_log TO readonly;

-- app_user: runtime CRUD minimal (NO DELETE, NO DDL)
GRANT SELECT, INSERT, UPDATE ON TABLE public.contacts TO app_user;
GRANT SELECT, INSERT, UPDATE ON TABLE public.companies TO app_user;
GRANT SELECT, INSERT, UPDATE ON TABLE public.deals TO app_user;
GRANT SELECT ON TABLE public.pipelines TO app_user;
GRANT SELECT ON TABLE public.pipeline_stages TO app_user;
GRANT SELECT, INSERT ON TABLE public.activities TO app_user;
GRANT SELECT ON TABLE public.owners TO app_user;

-- Webhook logs (dev/staging may use webhooks_log_dev; prod: webhooks_log)
-- Grant INSERT for runtime write, SELECT optional
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='webhooks_log') THEN
    GRANT INSERT ON TABLE public.webhooks_log TO app_user;
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='webhooks_log_dev') THEN
    GRANT INSERT ON TABLE public.webhooks_log_dev TO app_user;
  END IF;
END$$;

-- Sequences: allow nextval for INSERTed IDs where needed (usually SERIAL/BIGSERIAL)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user, readonly;

-- Future tables: default privileges (so new tables inherit sensible defaults)
-- Note: Must be run by a role that owns the objects (e.g., app_admin). Adjust OWNER accordingly.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_user, readonly;

-- Safety: ensure app_user has NO DELETE or DDL
-- We do not grant DELETE anywhere. For DDL, ensure app_user is not the owner of schema/tables.
-- If previously granted, revoke explicitly (idempotent).
REVOKE DELETE ON ALL TABLES IN SCHEMA public FROM app_user;
-- Revoke create on schema to avoid DDL:
REVOKE CREATE ON SCHEMA public FROM app_user;

-- Optional: Verify specific missing tables and grant accordingly (defensive)
-- Example helper to avoid migration failures if optional tables not present:
-- (Handled via DO blocks above for webhooks_log*)

-- End of 002_policies.sql
