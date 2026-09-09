-- Custom avatars are private, owned files.  `avatar_url` remains the legacy
-- OAuth/provider URL and is never overwritten by a mobile upload.
alter table public.users
  add column if not exists avatar_path text,
  add column if not exists avatar_source text,
  add column if not exists avatar_updated_at timestamptz;

alter table public.users drop constraint if exists users_avatar_source_check;
alter table public.users add constraint users_avatar_source_check
  check (avatar_source is null or avatar_source = 'uploaded');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-avatars', 'profile-avatars', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 2097152,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "profile avatars select own" on storage.objects;
drop policy if exists "profile avatars insert own" on storage.objects;
drop policy if exists "profile avatars update own" on storage.objects;
drop policy if exists "profile avatars delete own" on storage.objects;

-- Paths are intentionally constrained to <authenticated-user-id>/avatar/<file>.
create policy "profile avatars select own" on storage.objects for select to authenticated
  using (bucket_id = 'profile-avatars' and name ~ ('^' || auth.uid()::text || '/avatar/[A-Za-z0-9._-]+$'));
create policy "profile avatars insert own" on storage.objects for insert to authenticated
  with check (bucket_id = 'profile-avatars' and name ~ ('^' || auth.uid()::text || '/avatar/[A-Za-z0-9._-]+$'));
create policy "profile avatars update own" on storage.objects for update to authenticated
  using (bucket_id = 'profile-avatars' and name ~ ('^' || auth.uid()::text || '/avatar/[A-Za-z0-9._-]+$'))
  with check (bucket_id = 'profile-avatars' and name ~ ('^' || auth.uid()::text || '/avatar/[A-Za-z0-9._-]+$'));
create policy "profile avatars delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'profile-avatars' and name ~ ('^' || auth.uid()::text || '/avatar/[A-Za-z0-9._-]+$'));

-- Covers verified hard account deletion through auth/users cascades. Soft-deleted
-- profiles retain their avatar until the account is actually purged.
create or replace function public.delete_profile_avatar_on_user_delete()
returns trigger
language plpgsql
security definer
set search_path = public, storage
as $$
begin
  delete from storage.objects
  where bucket_id = 'profile-avatars' and name like old.id::text || '/avatar/%';
  return old;
end;
$$;

drop trigger if exists delete_profile_avatar_on_user_delete on public.users;
create trigger delete_profile_avatar_on_user_delete
before delete on public.users
for each row execute function public.delete_profile_avatar_on_user_delete();
