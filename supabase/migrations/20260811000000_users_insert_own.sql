-- Allow the authenticated backend request to lazily create a missing profile row.
-- The row remains restricted to the current Supabase Auth user.
create policy "users_insert_own"
  on public.users
  for insert
  with check (auth.uid() = id);
