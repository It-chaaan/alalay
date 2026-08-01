create table public.trusted_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index trusted_devices_user_expiry_idx
  on public.trusted_devices (user_id, expires_at);

alter table public.trusted_devices enable row level security;

comment on table public.trusted_devices is 'Hashed, browser-scoped device tokens used to skip TOTP for 30 days.';
