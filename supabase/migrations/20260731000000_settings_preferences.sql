alter table public.users add column if not exists phone text;

comment on column public.users.phone is 'Optional contact phone number.';
