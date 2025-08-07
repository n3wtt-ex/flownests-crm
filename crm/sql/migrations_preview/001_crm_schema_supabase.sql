-- 001_crm_schema_supabase.sql
-- Purpose: CRM core schema adapted for Supabase. Uses gen_random_uuid() (pgcrypto) for UUID defaults.

begin;

-- Ensure required extension is available (guarded in 000)
-- create extension if not exists "pgcrypto";

-- Owners (users)
create table if not exists owners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique not null,
  role text not null default 'owner',
  created_at timestamptz not null default now()
);

-- Companies
create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  domain text,
  location text,
  size text,
  industry text,
  website text,
  linkedin text,
  enrichment_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_companies_domain on companies(lower(domain));
create index if not exists idx_companies_name on companies(lower(name));

-- Contacts
create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  full_name text,
  title text,
  linkedin_url text,
  website text,
  phone text,
  company_id uuid references companies(id) on delete set null,
  owner_id uuid references owners(id) on delete set null,
  lifecycle_stage text check (lifecycle_stage in ('lead','MQL','SQL','customer')) default 'lead',
  reply_status text, -- interested | not_interested | question | null
  reply_summary text,
  generated_body_step1 text,
  generated_body_step2 text,
  generated_body_step3 text,
  latest_email_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_contacts_company_id on contacts(company_id);
create index if not exists idx_contacts_owner_id on contacts(owner_id);
create index if not exists idx_contacts_email on contacts(lower(email));

-- Pipelines
create table if not exists pipelines (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Pipeline Stages
create table if not exists pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid not null references pipelines(id) on delete cascade,
  name text not null,
  order_index int not null,
  probability int check (probability between 0 and 100) default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(pipeline_id, name),
  unique(pipeline_id, order_index)
);

create index if not exists idx_pipeline_stages_pipeline on pipeline_stages(pipeline_id);

-- Deals
create table if not exists deals (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  contact_id uuid references contacts(id) on delete set null,
  company_id uuid references companies(id) on delete set null,
  pipeline_id uuid not null references pipelines(id) on delete cascade,
  stage_id uuid not null references pipeline_stages(id) on delete restrict,
  amount numeric(14,2),
  currency text default 'USD',
  close_date date,
  status text check (status in ('open','won','lost')) default 'open',
  source text, -- apollo | gmaps | inbound | other
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_deals_pipeline_stage on deals(pipeline_id, stage_id);
create index if not exists idx_deals_company on deals(company_id);
create index if not exists idx_deals_contact on deals(contact_id);
create index if not exists idx_deals_status on deals(status);

-- Activities
create table if not exists activities (
  id uuid primary key default gen_random_uuid(),
  type text not null, -- email_in | email_out | call | meeting | task | note | system
  related_type text not null check (related_type in ('contact','deal','company')),
  related_id uuid not null,
  content text,
  meta_json jsonb,
  created_by uuid references owners(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_activities_related on activities(related_type, related_id);
create index if not exists idx_activities_type on activities(type);

-- Webhooks Log (dev/prod shared)
create table if not exists webhooks_log (
  id uuid primary key default gen_random_uuid(),
  source text not null, -- instantly | cal.com | crm-ui | ai | enrichment
  event_type text not null,
  idempotency_key text,
  payload_json jsonb not null,
  processed_at timestamptz,
  status text, -- received | processed | error
  created_at timestamptz not null default now()
);

create index if not exists idx_webhooks_log_source on webhooks_log(source);
create index if not exists idx_webhooks_log_idem on webhooks_log(idempotency_key);

-- updated_at trigger
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'set_updated_at_companies') then
    create trigger set_updated_at_companies before update on companies
    for each row execute function set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'set_updated_at_contacts') then
    create trigger set_updated_at_contacts before update on contacts
    for each row execute function set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'set_updated_at_pipelines') then
    create trigger set_updated_at_pipelines before update on pipelines
    for each row execute function set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'set_updated_at_pipeline_stages') then
    create trigger set_updated_at_pipeline_stages before update on pipeline_stages
    for each row execute function set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'set_updated_at_deals') then
    create trigger set_updated_at_deals before update on deals
    for each row execute function set_updated_at();
  end if;
end $$;

commit;
