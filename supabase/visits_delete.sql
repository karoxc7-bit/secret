-- Run in Supabase SQL Editor if delete is not allowed yet

create policy "authenticated delete visits"
  on public.visits for delete
  to authenticated
  using (true);
