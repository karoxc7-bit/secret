-- Run in Supabase SQL Editor after schema.sql
-- Adds the v3 collection columns. Safe to re-run.

alter table public.visits
  add column if not exists ip_geo jsonb,
  add column if not exists fingerprint text,
  add column if not exists gps_reason text;

create index if not exists visits_fingerprint_idx
  on public.visits (fingerprint);

create index if not exists visits_created_at_idx
  on public.visits (created_at desc);
