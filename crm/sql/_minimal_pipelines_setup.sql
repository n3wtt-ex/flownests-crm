BEGIN;

-- Ensure required extensions (chosen option: uuid-ossp)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1) Pipelines (idempotent)
CREATE TABLE IF NOT EXISTS pipelines (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2) Pipeline Stages (idempotent)
CREATE TABLE IF NOT EXISTS pipeline_stages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  pipeline_id uuid NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  name text NOT NULL,
  order_index int NOT NULL,
  probability int CHECK (probability BETWEEN 0 AND 100) DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(pipeline_id, name),
  UNIQUE(pipeline_id, order_index)
);

CREATE INDEX IF NOT EXISTS idx_pipeline_stages_pipeline ON pipeline_stages(pipeline_id);

-- 3) set_updated_at function (idempotent)
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at') THEN
    CREATE OR REPLACE FUNCTION set_updated_at()
    RETURNS trigger AS $f$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $f$ LANGUAGE plpgsql;
  END IF;
END
$do$;

-- 4) Triggers for existing tables only (idempotent & safe)
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='contacts') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='set_updated_at_contacts') THEN
      CREATE TRIGGER set_updated_at_contacts BEFORE UPDATE ON contacts
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='deals') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='set_updated_at_deals') THEN
      CREATE TRIGGER set_updated_at_deals BEFORE UPDATE ON deals
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='pipelines') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='set_updated_at_pipelines') THEN
      CREATE TRIGGER set_updated_at_pipelines BEFORE UPDATE ON pipelines
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='pipeline_stages') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='set_updated_at_pipeline_stages') THEN
      CREATE TRIGGER set_updated_at_pipeline_stages BEFORE UPDATE ON pipeline_stages
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    END IF;
  END IF;
END
$do$;

COMMIT;
