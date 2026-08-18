import { addDaysIso, client, requireUserId, throwIfError, todayIso } from './db.js';
import { createOwned, getOwned, listOwned, softDeleteOwned, updateOwned } from './crud.service.js';
import { AppError } from '../utils/api.js';
import { invalidateReportsForUser } from './analytics.service.js';

export async function listBills(
  userId: string,
  query: { status?: string; due_within_days?: number; category?: string },
) {
  let request = client()
    .from('bills')
    .select('*')
    .eq('user_id', requireUserId(userId))
    .is('deleted_at', null)
    .order('due_date', { ascending: true });
  if (query.status) request = request.eq('status', query.status);
  if (query.category) request = request.eq('category', query.category);
  if (query.due_within_days !== undefined)
    request = request
      .gte('due_date', todayIso())
      .lte('due_date', addDaysIso(query.due_within_days));
  const { data, error } = await request;
  throwIfError(error);
  return data ?? [];
}

export const getBill = (userId: string, id: string) => getOwned('bills', userId, id);
export const createBill = (userId: string, payload: Record<string, unknown>) =>
  createOwned('bills', userId, payload);
export const updateBill = (userId: string, id: string, payload: Record<string, unknown>) =>
  updateOwned('bills', userId, id, payload);
export const deleteBill = (userId: string, id: string) => softDeleteOwned('bills', userId, id);

export async function payBill(
  userId: string,
  id: string,
  payment: { wallet_id: string; payment_date: string; occurrence_date: string },
) {
  requireUserId(userId);
  const { data, error } = await client().rpc('mark_bill_paid', {
    target_bill_id: id,
    selected_wallet_id: payment.wallet_id,
    selected_payment_date: payment.payment_date,
    selected_occurrence_date: payment.occurrence_date,
  });
  if (error) {
    const message = error.message.toLowerCase();
    if (
      error.code === 'pgrst202' ||
      message.includes('could not find the function') ||
      message.includes('function public.mark_bill_paid')
    ) {
      throw new AppError(
        503,
        'bill_payment_rpc_unavailable',
        'Bill payment is not available because the payment service migration is not deployed.',
        error.message,
        true,
      );
    }
    if (message.includes('authentication required'))
      throw new AppError(401, 'unauthorized', 'Your session is no longer valid.');
    if (message.includes('bill not found')) throw new AppError(404, 'not_found', 'Bill not found.');
    if (message.includes('already paid'))
      throw new AppError(409, 'conflict', 'This bill has already been marked as paid.');
    if (message.includes('occurrence changed'))
      throw new AppError(
        409,
        'conflict',
        'This bill occurrence has already changed. Refresh and try again.',
      );
    if (message.includes('wallet does not belong'))
      throw new AppError(403, 'forbidden', 'That wallet is not available.');
    throw new AppError(500, 'database_error', 'Unable to mark this bill as paid.', error.message);
  }
  invalidateReportsForUser(userId);
  return data;
}

export async function billSummary(userId: string) {
  const rows = await listOwned('bills', userId);
  const unpaid = rows.filter((row) => row.status !== 'paid');
  return {
    total_unpaid: unpaid.reduce((sum, row) => sum + Number(row.amount || 0), 0),
    due_this_week: unpaid
      .filter((row) => row.due_date >= todayIso() && row.due_date <= addDaysIso(7))
      .reduce((sum, row) => sum + Number(row.amount || 0), 0),
    overdue: unpaid
      .filter((row) => row.status === 'overdue' || row.due_date < todayIso())
      .reduce((sum, row) => sum + Number(row.amount || 0), 0),
    items: rows,
  };
}
