-- Repair duplicate stored avatars before adding the invariant below.
-- Keep the oldest profile's value; for later duplicates, prefer that user's
-- provider picture when it differs, otherwise clear it so the UI uses initials.
with ranked_duplicates as (
  select
    id,
    avatar_url,
    row_number() over (partition by avatar_url order by created_at, id) as duplicate_rank
  from public.users
  where avatar_url is not null
), provider_avatars as (
  select
    profile.id,
    coalesce(auth_user.raw_user_meta_data ->> 'picture', auth_user.raw_user_meta_data ->> 'avatar_url') as avatar_url
  from public.users profile
  join auth.users auth_user on auth_user.id = profile.id
)
update public.users profile
set avatar_url = case
  when provider_avatars.avatar_url is not null
    and provider_avatars.avatar_url <> ranked_duplicates.avatar_url
    then provider_avatars.avatar_url
  else null
end
from ranked_duplicates
left join provider_avatars on provider_avatars.id = ranked_duplicates.id
where profile.id = ranked_duplicates.id
  and ranked_duplicates.duplicate_rank > 1;

create unique index if not exists users_avatar_url_unique_idx
  on public.users (avatar_url)
  where avatar_url is not null;

-- Persist Google profile pictures at profile creation. Email/password users
-- have no provider picture and continue to use the neutral initials fallback.
create or replace function public.handle_new_user()
returns trigger as $$
declare
  provider_avatar text;
begin
  provider_avatar := coalesce(new.raw_user_meta_data->>'picture', new.raw_user_meta_data->>'avatar_url');

  -- A provider may return a shared/default image URL. Do not copy it into a
  -- second profile; the frontend will render the neutral initials avatar.
  if provider_avatar is not null and exists (
    select 1 from public.users where avatar_url = provider_avatar
  ) then
    provider_avatar := null;
  end if;

  insert into public.users (id, name, email, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(coalesce(new.email, ''), '@', 1)),
    new.email,
    provider_avatar
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;
