create or replace function public.set_savings_goal_monthly_target()
returns trigger as $$
begin
  new.monthly_target := coalesce(new.monthly_target, 0);
  return new;
end;
$$ language plpgsql;
