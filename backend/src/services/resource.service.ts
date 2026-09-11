import { client, requireUserId, throwIfError, todayIso, type TableName } from './db.js';
import { createOwned, getOwned, listOwned, softDeleteOwned, updateOwned } from './crud.service.js';
import { AppError } from '../utils/api.js';
import { invalidateReportsForUser } from './analytics.service.js';
import { expandIncomeRows } from './income-recurrence.service.js';
import { nextUpcomingRenewal, type SubscriptionBillingCycle } from './subscription-billing.service.js';

export function makeResourceService(table: TableName) {
  return {
    list: async (userId: string, filters?: Record<string, unknown>) => {
      const rows = await listOwned(table, userId, filters);
      if (table !== 'income') return rows;
      const from = typeof filters?.from === 'string' ? filters.from : '1900-01-01';
      const to = typeof filters?.to === 'string' ? filters.to : addDays(from, 400);
      return expandIncomeRows(rows, from, to);
    },
    get: (userId: string, id: string) => getOwned(table, userId, id),
    create: async (userId: string, payload: Record<string, unknown>) => {
      const result = table === 'income' && payload.is_recurring === true
        ? await createIncomeSchedule(userId, payload)
        : await createOwned(table, userId, table === 'income' ? scheduleIncomePayload(payload) : payload);
      invalidateReportsForUser(userId);
      return result;
    },
    update: async (userId: string, id: string, payload: Record<string, unknown>) => {
      if (table === 'subscriptions') {
        const { data: current, error } = await client()
          .from('subscriptions')
          .select('auto_renew, wallet_id')
          .eq('id', id)
          .eq('user_id', requireUserId(userId))
          .is('deleted_at', null)
          .maybeSingle();
        throwIfError(error);
        const active = payload.auto_renew !== false && current?.auto_renew !== false;
        const walletId = payload.wallet_id === undefined ? current?.wallet_id : payload.wallet_id;
        if (active && !walletId)
          throw new AppError(
            400,
            'validation_error',
            'Choose a payment wallet for this active subscription.',
          );
      }
      const result = await updateOwned(table, userId, id, payload);
      invalidateReportsForUser(userId);
      return result;
    },
    remove: async (userId: string, id: string) => {
      if (table === 'income') {
        const { data, error } = await client().rpc('delete_income', { target_income_id: id });
        if (error) {
          console.error('[income.delete] database failure', {
            operation: 'delete_income',
            incomeId: id,
            userId,
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint,
          });
          if (error.code === 'P0002') throw new AppError(404, 'not_found', 'Record not found.');
          throwIfError(error);
        }
        invalidateReportsForUser(userId);
        return data;
      }
      if (table === 'savings_goals') {
        const { data, error } = await client().rpc('delete_savings_goal', { target_goal_id: id });
        if (error) {
          console.error('[savings-goal.delete] database failure', {
            operation: 'delete_savings_goal',
            goalId: id,
            userId,
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint,
          });
          if (error.code === 'P0002') throw new AppError(404, 'not_found', 'Record not found.');
          throwIfError(error);
        }
        invalidateReportsForUser(userId);
        return { id: data };
      }
      const result = await softDeleteOwned(table, userId, id);
      invalidateReportsForUser(userId);
      return result;
    },
  };
}

export async function skipIncomeOccurrence(userId: string, sourceId: string, date: string) {
  // The SQL RPC rechecks ownership and schedule/date validity under a row lock.
  const { data, error } = await client().rpc('skip_income_occurrence', {
    target_source_id: sourceId,
    target_date: date,
  });
  if (error) {
    if (error.code === 'P0002') throw new AppError(404, 'not_found', 'Income schedule not found.');
    if (error.code === '22007') throw new AppError(400, 'validation_error', 'That date is not scheduled income.');
    throwIfError(error);
  }
  invalidateReportsForUser(userId);
  return data;
}

/**
 * Pausing is deliberately separate from the generic subscription editor.
 * Resuming moves an elapsed renewal forward, so the scheduler cannot create
 * expenses or reminders for periods while the subscription was paused.
 */
export async function setSubscriptionStatus(userId: string, id: string, autoRenew: boolean) {
  const ownerId = requireUserId(userId);
  const { data: current, error: lookupError } = await client()
    .from('subscriptions')
    .select('id, auto_renew, renewal_date, billing_cycle, wallet_id')
    .eq('id', id)
    .eq('user_id', ownerId)
    .is('deleted_at', null)
    .maybeSingle();
  if (lookupError) throwIfError(lookupError);
  if (!current) throw new AppError(404, 'not_found', 'Record not found.');
  if (autoRenew && !current.wallet_id) {
    throw new AppError(400, 'validation_error', 'Choose a payment wallet before resuming this subscription.');
  }

  const cycle: SubscriptionBillingCycle = ['weekly', 'monthly', 'quarterly', 'yearly'].includes(
    String(current.billing_cycle),
  )
    ? current.billing_cycle as SubscriptionBillingCycle
    : 'monthly';
  const renewalDate = autoRenew
    ? nextUpcomingRenewal(String(current.renewal_date), cycle, todayIso())
    : current.renewal_date;
  const { data, error } = await client()
    .from('subscriptions')
    .update({ auto_renew: autoRenew, renewal_date: renewalDate })
    .eq('id', id)
    .eq('user_id', ownerId)
    .is('deleted_at', null)
    .select('*')
    .maybeSingle();
  if (error) throwIfError(error);
  if (!data) throw new AppError(404, 'not_found', 'Record not found.');
  invalidateReportsForUser(ownerId);
  return data;
}

async function createIncomeSchedule(userId: string, payload: Record<string, unknown>) {
  const { data, error } = await client().rpc('create_income_schedule', {
    owner_id: requireUserId(userId),
    wallet_id_value: payload.wallet_id,
    source_value: payload.source,
    type_value: payload.type ?? null,
    custom_type_value: payload.custom_type ?? null,
    amount_value: payload.amount,
    date_value: payload.date,
    frequency_value: payload.frequency,
    request_key: payload.idempotency_key ?? null,
  });
  throwIfError(error);
  return data;
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function scheduleIncomePayload(payload: Record<string, unknown>) {
  // A recurrence is always a Manila-date schedule definition, including one
  // that starts today. The scheduler posts each due occurrence exactly once;
  // storing it as manual income would leave no schedule to project next month.
  if (payload.is_recurring === true)
    return {
      ...payload,
      schedule_anchor_date: payload.date,
      is_posted: false,
      schedule_status: 'active',
      source_type: null,
      received_at: null,
    };
  if (String(payload.date ?? '') <= todayIso())
    return {
      ...payload,
      is_posted: true,
      schedule_status: 'posted',
      source_type: 'manual',
      received_at: new Date().toISOString(),
    };
  return {
    ...payload,
    is_posted: false,
    schedule_status: 'active',
    source_type: null,
    received_at: null,
  };
}

export async function listByDateRange(
  table: TableName,
  userId: string,
  dateColumn: string,
  from?: string,
  to?: string,
) {
  let query = client()
    .from(table)
    .select('*')
    .eq('user_id', requireUserId(userId))
    .is('deleted_at', null)
    .order(dateColumn, { ascending: false });
  if (from) query = query.gte(dateColumn, from);
  if (to) query = query.lte(dateColumn, to);
  const { data, error } = await query;
  throwIfError(error);
  return data ?? [];
}
