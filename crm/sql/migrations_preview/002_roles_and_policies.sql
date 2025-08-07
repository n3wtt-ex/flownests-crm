-- 002_roles_and_policies.sql
-- Purpose: Create idempotent runtime roles (app_user, readonly) and grant minimal privileges.
-- Note: Supabase commonly uses anon/authenticated/service_role. This script follows your docs (app_user/readonly).

begin;

-- Idempotent role creation (no error if exists)
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_user') then
    create role app_user login password 'app_user_password_placeholder';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'readonly') then
    create role readonly login password 'readonly_password_placeholder';
  end if;
end$$;

-- Safety: revoke broad public privileges
revoke all on all tables in schema public from public;
revoke all on all sequences in schema public from public;

-- Minimal schema usage
grant usage on schema public to app_user, readonly;

-- Readonly: SELECT-only on data tables
grant select on table public.contacts to readonly;
grant select on table public.companies to readonly;
grant select on table public.deals to readonly;
grant select on table public.pipelines to readonly;
grant select on table public.pipeline_stages to readonly;
grant select on table public.activities to readonly;
grant select on table public.owners to readonly;
-- grant select on table public.webhooks_log to readonly; -- optional

-- app_user: runtime CRUD minimal (NO DELETE, NO DDL)
grant select, insert, update on table public.contacts to app_user;
grant select, insert, update on table public.companies to app_user;
grant select, insert, update on table public.deals to app_user;
grant select on table public.pipelines to app_user;
grant select on table public.pipeline_stages to app_user;
grant select, insert on table public.activities to app_user;
grant select on table public.owners to app_user;

-- Webhook logs (dev/prod shared): allow insert for runtime
do $$
begin
  if exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
             where n.nspname='public' and c.relname='webhooks_log') then
    grant insert on table public.webhooks_log to app_user;
  end if;
end$$;

-- Sequences usage
grant usage, select on all sequences in schema public to app_user, readonly;

-- Default privileges for future tables/sequences (must be executed by owner of objects)
alter default privileges in schema public grant select on tables to readonly;
alter default privileges in schema public grant select, insert, update on tables to app_user;
alter default privileges in schema public grant usage, select on sequences to app_user, readonly;

-- Ensure app_user has no delete or DDL
revoke delete on all tables in schema public from app_user;
revoke create on schema public from app_user;

-- Optional RLS toggles (left commented if policies are defined elsewhere)
-- alter table public.contacts enable row level security;
-- alter table public.companies enable row level security;
-- alter table public.deals enable row level security;
-- alter table public.pipelines enable row level security;
-- alter table public.pipeline_stages enable row level security;
-- alter table public.activities enable row level security;
-- alter table public.owners enable row level security;
-- alter table public.webhooks_log enable row level security;

commit;
