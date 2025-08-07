BEGIN;

-- Ensure uuid-ossp for uuid_generate_v4()
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Minimal owners table (idempotent)
CREATE TABLE IF NOT EXISTS owners (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  role text NOT NULL DEFAULT 'owner',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Minimal companies table (idempotent)
CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  domain text,
  location text,
  size text,
  industry text,
  website text,
  linkedin text,
  enrichment_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Helpful indexes (idempotent)
CREATE INDEX IF NOT EXISTS idx_companies_domain ON companies (LOWER(domain));
CREATE INDEX IF NOT EXISTS idx_companies_name ON companies (LOWER(name));

COMMIT;
