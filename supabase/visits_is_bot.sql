-- Run in Supabase SQL Editor if visits table already exists

alter table public.visits
  add column if not exists is_bot boolean not null default false;
