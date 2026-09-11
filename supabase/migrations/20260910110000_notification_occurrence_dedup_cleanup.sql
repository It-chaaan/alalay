-- Diagnostic query (run before/after deployment):
-- select user_id, related_bill_id, related_bill_occurrence_id, type, title, body, count(*)
-- from public.notifications where type in ('bill_due', 'bill_overdue')
-- group by 1,2,3,4,5,6 having count(*) > 1;

-- Historical duplicates were emitted once from a bill template and once from
-- its occurrence. Keep the earliest row and preserve an unread state if any
-- member is unread. Grouping includes bill identity, stage/type and immutable
-- rendered due-date body, so different dates or stages are never merged.
with duplicate_groups as (
  select user_id, related_bill_id, type, title, body,
         bool_or(read_at is null) as has_unread, max(read_at) as latest_read_at
  from public.notifications
  where type in ('bill_due', 'bill_overdue') and related_bill_id is not null
  group by user_id, related_bill_id, type, title, body
  having count(*) > 1
), canonical as (
  select distinct on (n.user_id, n.related_bill_id, n.type, n.title, n.body)
    n.id, g.has_unread, g.latest_read_at
  from public.notifications n join duplicate_groups g
    on g.user_id = n.user_id and g.related_bill_id = n.related_bill_id
    and g.type = n.type and g.title = n.title and g.body = n.body
  order by n.user_id, n.related_bill_id, n.type, n.title, n.body, n.created_at, n.id
)
update public.notifications n set read_at = case when c.has_unread then null else c.latest_read_at end,
  read = not c.has_unread from canonical c where n.id = c.id;

with ranked as (
  select n.id, row_number() over (partition by n.user_id, n.related_bill_id, n.type, n.title, n.body order by n.created_at, n.id) as seq
  from public.notifications n where n.type in ('bill_due', 'bill_overdue') and n.related_bill_id is not null
)
delete from public.notifications n using ranked r where n.id = r.id and r.seq > 1;
