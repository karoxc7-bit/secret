-- Run in Supabase SQL Editor (free project)

create table if not exists public.visits (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  ip text,
  ip_source text,
  device_info jsonb,
  location_granted boolean not null default false,
  location jsonb,
  camera_granted boolean not null default false,
  photo_base64 text,
  referrer text,
  page_url text
);

alter table public.visits enable row level security;

-- Anyone can insert a visit (public landing page)
create policy "anon insert visits"
  on public.visits for insert
  to anon
  with check (true);

-- Only logged-in users (admin) can read
create policy "authenticated read visits"
  on public.visits for select
  to authenticated
  using (true);
