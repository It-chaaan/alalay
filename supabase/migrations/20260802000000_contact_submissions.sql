create table public.contact_submissions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  category text not null default 'General inquiry',
  message text not null,
  created_at timestamptz not null default now()
);
alter table public.contact_submissions enable row level security;
create policy "contact_submissions_public_insert" on public.contact_submissions for insert to anon, authenticated with check (char_length(trim(name)) between 1 and 120 and char_length(trim(email)) between 3 and 320 and char_length(trim(message)) between 1 and 5000 and category in ('General inquiry', 'Bug report', 'Billing question', 'Other'));
comment on table public.contact_submissions is 'Public contact form submissions; email delivery is not yet configured.';
