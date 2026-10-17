-- Run in Supabase SQL Editor after migration_v3.sql
-- Forces PostgREST to drop its cached schema so the new columns are visible.

notify pgrst, 'reload schema';
