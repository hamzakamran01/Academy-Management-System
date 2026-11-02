-- Campusly · 0002 · Database-level guards
-- The activity log is append-only (FR-ADM-01, BR-ADM-03). This trigger blocks
-- UPDATE and DELETE for every database role, including the application's own.
CREATE OR REPLACE FUNCTION campusly_block_activity_log_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'activity_log is append-only';
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS activity_log_append_only ON activity_log;
--> statement-breakpoint
CREATE TRIGGER activity_log_append_only
  BEFORE UPDATE OR DELETE ON activity_log
  FOR EACH ROW EXECUTE FUNCTION campusly_block_activity_log_mutation();
--> statement-breakpoint
-- Row Level Security on: blocks Supabase's public REST API (anon/authenticated keys)
-- from touching any table. Campusly connects as the table owner, which bypasses RLS.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END;
$$;
