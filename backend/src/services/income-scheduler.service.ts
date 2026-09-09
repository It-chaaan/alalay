import { client, requireUserId, throwIfError } from "./db.js";
import { AppError } from '../utils/api.js';

/**
 * Processes due schedules inside the database. The SQL function locks each
 * schedule row and uses a unique occurrence key, so overlapping Render
 * instances and retries cannot post the same payday twice.
 */
export async function processIncomeSchedules() {
  const { data, error } = await client().rpc("process_due_income_schedules", {
    target_schedule_id: null,
    target_owner_id: null,
  });
  throwIfError(error);
  return Number(data ?? 0);
}

/** Recovery only: ownership is checked before the service-role scheduler RPC. */
export async function retryIncomeScheduleCredit(userId: string, scheduleId: string) {
  const ownerId = requireUserId(userId);
  const { data: schedule, error: scheduleError } = await client()
    .from('income')
    .select('id, is_posted, schedule_status')
    .eq('id', scheduleId)
    .eq('user_id', ownerId)
    .is('deleted_at', null)
    .maybeSingle();
  throwIfError(scheduleError);
  if (!schedule || schedule.is_posted || schedule.schedule_status !== 'active')
    throw new AppError(404, 'income_schedule_not_found', 'A retryable income schedule was not found.');

  const { data, error } = await client().rpc('process_due_income_schedules', {
    target_schedule_id: scheduleId,
    target_owner_id: ownerId,
  });
  throwIfError(error);
  return { processed: Number(data ?? 0) };
}

export function startIncomeScheduler() {
  const run = () => void processIncomeSchedules()
    .then((count) => { if (count) console.log(`Income scheduler posted ${count} due occurrence(s).`); })
    .catch((error) => console.error("Income scheduler failed:", error));
  run();
  setInterval(run, 60 * 60 * 1000);
  console.log("Income scheduler enabled; running hourly.");
}
