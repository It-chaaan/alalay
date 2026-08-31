-- Regression: a predicate-free PostgREST ON CONFLICT target must be backed by
-- a non-partial unique index on exactly (user_id, deduplication_key).
do $$
declare
  has_matching_index boolean;
begin
  select exists (
    select 1
    from pg_index i
    where i.indrelid = 'public.notifications'::regclass
      and i.indisunique
      and pg_get_indexdef(i.indexrelid) like '%(user_id, deduplication_key)%'
      and i.indpred is null
  ) into has_matching_index;
  if not has_matching_index then
    raise exception 'notifications needs a non-partial unique index on (user_id, deduplication_key)';
  end if;
end $$;
