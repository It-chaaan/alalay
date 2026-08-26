-- Trusted devices are accessed with the caller-authenticated Supabase client.
-- Keep RLS enabled and allow users to manage only their own hashed device rows.
create policy "trusted_devices_select_own"
  on public.trusted_devices
  for select
  using (auth.uid() = user_id);

create policy "trusted_devices_insert_own"
  on public.trusted_devices
  for insert
  with check (auth.uid() = user_id);

create policy "trusted_devices_delete_own"
  on public.trusted_devices
  for delete
  using (auth.uid() = user_id);
