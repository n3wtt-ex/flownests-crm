-- Idempotent UNIQUE constraints and indexes required by 003_seed.sql
-- Run this file in pgAdmin Query Tool, then run 003_seed.sql

-- pipelines: uniq_pipelines_is_default (UNIQUE on is_default)
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uniq_pipelines_is_default'
  ) THEN
    ALTER TABLE pipelines
      ADD CONSTRAINT uniq_pipelines_is_default UNIQUE (is_default);
  END IF;
END
$do$;

-- pipeline_stages: uniq_pipeline_stages_name (pipeline_id, name)
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uniq_pipeline_stages_name'
  ) THEN
    ALTER TABLE pipeline_stages
      ADD CONSTRAINT uniq_pipeline_stages_name UNIQUE (pipeline_id, name);
  END IF;
END
$do$;

-- pipeline_stages: uniq_pipeline_stages_order (pipeline_id, order_index)
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uniq_pipeline_stages_order'
  ) THEN
    ALTER TABLE pipeline_stages
      ADD CONSTRAINT uniq_pipeline_stages_order UNIQUE (pipeline_id, order_index);
  END IF;
END
$do$;

-- companies: uniq_companies_name (name)
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uniq_companies_name'
  ) THEN
    ALTER TABLE companies
      ADD CONSTRAINT uniq_companies_name UNIQUE (name);
  END IF;
END
$do$;

-- deals: uniq_deals_contact_stage (contact_id, stage_id) via index (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_deals_contact_stage ON deals(contact_id, stage_id);
