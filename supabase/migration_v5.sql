-- Run in Supabase SQL Editor (after migration_v4)
-- Adds the tag column for username-based link tracking. Safe to re-run.

alter table public.visits
  add column if not exists tag text;

create index if not exists visits_tag_idx
  on public.visits (tag)
  where tag is not null;

-- Update the anon insert policy to allow the tag column
-- (existing policy already allows all columns via with check (true))
