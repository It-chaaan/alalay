import { client, requireUserId, throwIfError, todayIso, type TableName } from './db.js';
import { createOwned, getOwned, listOwned, softDeleteOwned, updateOwned } from './crud.service.js';
import { AppError } from '../utils/api.js';
import { invalidateReportsForUser } from './analytics.service.js';
import { expandIncomeRows } from './income-recurrence.service.js';

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
      const result = await createOwned(
        table,
        userId,
        table === 'income' ? scheduleIncomePayload(payload) : payload,
      );
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
      const result = await softDeleteOwned(table, userId, id);
      invalidateReportsForUser(userId);
      return result;
    },
  };
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
