-- 003_seed_fix.sql
-- Purpose: Seed default pipeline/stages, demo owner/company/contact/deal.
-- Fixes: Corrects a stray comma in companies insert from original 003_seed.sql.

begin;

-- Ensure a default pipeline exists
insert into pipelines (id, name, is_default)
values (gen_random_uuid(), 'Default Sales', true)
on conflict do nothing;

-- Ensure default stages exist for the default pipeline
with def as (
  select id from pipelines where is_default = true order by created_at asc limit 1
)
insert into pipeline_stages (id, pipeline_id, name, order_index, probability)
select gen_random_uuid(), def.id, s.name, s.order_index, s.probability
from def,
lateral (values
  ('New', 10, 10),
  ('Contacted', 20, 25),
  ('Qualified', 30, 45),
  ('Meeting Scheduled', 40, 60),
  ('Proposal Sent', 50, 75),
  ('Won', 90, 100),
  ('Lost', 95, 0)
) as s(name, order_index, probability)
on conflict do nothing;

-- Demo owner
insert into owners (id, name, email, role)
values (gen_random_uuid(), 'Demo Owner', 'owner@example.com', 'owner')
on conflict (email) do nothing;

-- Demo company (fix: removed stray comma before 'NY, USA')
insert into companies (id, name, domain, website, linkedin, location, size, industry)
values (
  gen_random_uuid(),
  'Acme Inc.',
  'acme.com',
  'https://acme.com',
  'https://www.linkedin.com/company/acme',
  'NY, USA',
  '51-200',
  'SaaS'
)
on conflict (name) do nothing;

-- Demo contact
with
  c as (select id as company_id from companies where name = 'Acme Inc.' limit 1),
  o as (select id as owner_id from owners where email = 'owner@example.com' limit 1)
insert into contacts (id, email, full_name, title, company_id, owner_id, lifecycle_stage)
select gen_random_uuid(), 'john@acme.com', 'John Doe', 'VP Sales', c.company_id, o.owner_id, 'lead'
from c, o
on conflict (email) do nothing;

-- Demo deal at default pipeline "New"
with
  c as (select id as company_id from companies where name = 'Acme Inc.' limit 1),
  ct as (select id as contact_id from contacts where email = 'john@acme.com' limit 1),
  p as (select id as pipeline_id from pipelines where is_default = true limit 1),
  s as (
    select ps.id as stage_id
    from pipeline_stages ps
    join p on p.pipeline_id = ps.pipeline_id
    where ps.name = 'New' limit 1
  )
insert into deals (id, title, company_id, contact_id, pipeline_id, stage_id, amount, currency, status, source, notes)
select gen_random_uuid(), 'Acme - Pilot', c.company_id, ct.contact_id, p.pipeline_id, s.stage_id, 2500, 'USD', 'open', 'inbound', 'Seed deal'
from c, ct, p, s
on conflict do nothing;

-- Demo system activity
with d as (select id as deal_id from deals where title = 'Acme - Pilot' limit 1)
insert into activities (id, type, related_type, related_id, content, meta_json)
select gen_random_uuid(), 'system', 'deal', d.deal_id, 'Seed: deal created', jsonb_build_object('seed', true)
from d
on conflict do nothing;

commit;
