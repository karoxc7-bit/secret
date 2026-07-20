-- Run once in Supabase SQL Editor (after schema.sql)

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
