create table if not exists public.income_skipped_occurrences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_id uuid not null references public.income(id) on delete cascade,
  occurrence_date date not null,
  created_at timestamptz not null default now(),
  unique (user_id, source_id, occurrence_date)
);

alter table public.income_skipped_occurrences enable row level security;
create policy "income skipped occurrences own" on public.income_skipped_occurrences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.skip_income_occurrence(target_source_id uuid, target_date date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  owner_id uuid := auth.uid(); schedule_row public.income%rowtype; candidate date;
begin
  if owner_id is null then raise exception 'authentication required' using errcode = '42501'; end if;
  select * into schedule_row from public.income
    where id = target_source_id and user_id = owner_id and deleted_at is null
      and is_posted = false and is_recurring = true and schedule_status = 'active'
    for update;
  if not found then raise exception 'income schedule not found' using errcode = 'P0002'; end if;
  candidate := coalesce(schedule_row.schedule_anchor_date, schedule_row.date);
  while candidate < target_date loop candidate := public.add_income_cycle(candidate, schedule_row.frequency); end loop;
  if candidate <> target_date then raise exception 'date is not an occurrence of this schedule' using errcode = '22007'; end if;
  insert into public.income_skipped_occurrences(user_id, source_id, occurrence_date)
    values(owner_id, target_source_id, target_date) on conflict (user_id, source_id, occurrence_date) do nothing;
  return jsonb_build_object('source_id', target_source_id, 'occurrence_date', target_date, 'status', 'skipped');
end;
$$;
revoke all on function public.skip_income_occurrence(uuid, date) from public;
grant execute on function public.skip_income_occurrence(uuid, date) to authenticated;

create or replace function public.process_due_income_schedules()
returns integer language plpgsql security definer set search_path = public as $$
declare schedule_row public.income%rowtype; posted_id uuid; occurrence text;
  due_today date := (now() at time zone 'Asia/Manila')::date; processed integer := 0;
begin
  for schedule_row in select * from public.income where is_posted = false and schedule_status = 'active' and deleted_at is null and date <= due_today order by date, id for update skip locked loop
    occurrence := schedule_row.id::text || ':' || schedule_row.date::text;
    if not exists (select 1 from public.income_skipped_occurrences s where s.user_id = schedule_row.user_id and s.source_id = schedule_row.id and s.occurrence_date = schedule_row.date) then
      insert into public.income (user_id, wallet_id, source, type, custom_type, amount, date, is_recurring, frequency, is_posted, schedule_status, schedule_id, occurrence_key)
      values (schedule_row.user_id, schedule_row.wallet_id, schedule_row.source, schedule_row.type, schedule_row.custom_type, schedule_row.amount, schedule_row.date, false, null, true, 'posted', schedule_row.id, occurrence)
      on conflict (occurrence_key) do nothing returning id into posted_id;
      if posted_id is not null then processed := processed + 1; end if;
    end if;
    if coalesce(schedule_row.is_recurring, false) then update public.income set date = public.add_income_cycle(schedule_row.date, schedule_row.frequency), updated_at = now() where id = schedule_row.id;
    else update public.income set schedule_status = 'completed', updated_at = now() where id = schedule_row.id; end if;
  end loop;
  return processed;
end;
$$;
