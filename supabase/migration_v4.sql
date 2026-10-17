-- Run in Supabase SQL Editor (after migration_v3)
-- Realtime + optional traffic helpers. Safe to re-run.

-- Ensure visits are in the realtime publication
do $$
begin
  alter publication supabase_realtime add table public.visits;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

-- Optional dedicated traffic column (also stored inside device_info.traffic)
alter table public.visits
  add column if not exists traffic jsonb;

create index if not exists visits_is_bot_idx
  on public.visits (is_bot);

-- ---------------------------------------------------------------------------
-- Recommended: Database Webhook (server-side, tokens stay private)
-- Dashboard → Database → Webhooks → Create
--   Table: visits · Events: INSERT
--   URL: your Discord webhook OR a relay that posts to Telegram
-- Payload: record JSON (strip photo_base64 in the relay if needed)
-- ---------------------------------------------------------------------------
