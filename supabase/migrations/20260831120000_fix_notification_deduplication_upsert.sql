-- createInAppNotification uses:
--   ON CONFLICT (user_id, deduplication_key)
-- A partial index cannot be inferred by that predicate-free conflict target,
-- which caused production PostgreSQL error 42P10. NULL keys remain distinct
-- under a regular PostgreSQL unique index, so ordinary non-deduplicated inbox
-- rows are still permitted.

-- Diagnostic query to run before/after deployment when investigating a remote
-- project. It intentionally scopes only the actual idempotency key:
-- select user_id, deduplication_key, count(*)
-- from public.notifications
-- where deduplication_key is not null
-- group by user_id, deduplication_key
-- having count(*) > 1;

-- Canonical row: earliest notification. Preserve unread state if any duplicate
-- is unread; otherwise retain the latest known read timestamp. No rows with a
-- different user/key are touched, and the update/delete is idempotent.
with duplicate_groups as (
  select user_id, deduplication_key,
         bool_or(read_at is null) has_unread,
         max(read_at) latest_read_at
  from public.notifications
  where deduplication_key is not null
  group by user_id, deduplication_key
  having count(*) > 1
), canonical as (
  select distinct on (n.user_id, n.deduplication_key)
         n.id, n.user_id, n.deduplication_key, d.has_unread, d.latest_read_at
  from public.notifications n
  join duplicate_groups d using (user_id, deduplication_key)
  order by n.user_id, n.deduplication_key, n.created_at asc, n.id asc
)
update public.notifications n
set read_at = case when c.has_unread then null else c.latest_read_at end,
    read = not c.has_unread
from canonical c
where n.id = c.id;

with ranked as (
  select id,
         row_number() over (partition by user_id, deduplication_key order by created_at asc, id asc) as sequence
  from public.notifications
  where deduplication_key is not null
)
delete from public.notifications n
using ranked r
where n.id = r.id and r.sequence > 1;

drop index if exists public.notifications_user_deduplication_unique;
create unique index notifications_user_deduplication_unique
  on public.notifications (user_id, deduplication_key);
