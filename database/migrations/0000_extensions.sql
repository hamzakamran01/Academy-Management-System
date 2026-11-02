-- Campusly · 0000 · Extensions
-- Run this first. Supabase and Neon both allow these extensions.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- fast fuzzy search on student names
