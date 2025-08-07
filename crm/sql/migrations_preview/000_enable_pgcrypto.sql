-- 000_enable_pgcrypto.sql
-- Purpose: Ensure pgcrypto is available so we can use gen_random_uuid() across the schema.

begin;

create extension if not exists "pgcrypto";

commit;
