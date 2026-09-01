import { client, monthRange, requireUserId, throwIfError, todayIso } from './db.js';
import { expandIncomeRows, isRecurring } from './income-recurrence.service.js';

export type MyIncomeItem = {
  kind: 'recurring' | 'one_time';
  sourceId: string;
  occurrenceId: string | null;
  transactionId: string | null;
  name: string;
  category: string;
  amount: number;
  frequency: string | null;
  status: 'received' | 'upcoming' | 'due' | 'failed' | 'not_started';
  dueDate: string | null;
  receivedDate: string | null;
  receivedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  walletId: string;
};

export type IncomeSummaryRange = {
  rows: Array<Record<string, any>>;
  sourceRows: Array<Record<string, any>>;
  actualRows: Array<Record<string, any>>;
  scheduledRows: Array<Record<string, any>>;
  total: number;
  actualTotal: number;
  scheduledTotal: number;
};

async function allIncomeRows(userId: string, from?: string, to?: string) {
  let query = client()
    .from('income')
    .select('*')
    .eq('user_id', requireUserId(userId))
    .is('deleted_at', null)
    .order('date', { ascending: false });
  if (from && to) query = query.or(`date.gte.${from},is_recurring.eq.true`);
  const { data, error } = await query;
  throwIfError(error);
  return data ?? [];
}

function summarize(rows: Array<Record<string, any>>, sourceRows = rows): IncomeSummaryRange {
  const actualRows = rows.filter((row) => !row.is_scheduled && row.is_posted !== false);
  const scheduledRows = rows.filter((row) => Boolean(row.is_scheduled));
  const actualTotal = actualRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const scheduledTotal = scheduledRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);

  return {
    rows,
    sourceRows,
    actualRows,
    scheduledRows,
    total: actualTotal,
    actualTotal,
    scheduledTotal,
  };
}

/** Single source of truth for income in any selected date range. */
export async function incomeForRange(userId: string, from: string, to: string) {
  const rows = await allIncomeRows(userId, from, to);
  return summarize(expandIncomeRows(rows, from, to), rows);
}

/** Single source of truth for the selected calendar month. */
export async function incomeForMonth(userId: string, month?: string) {
  const selectedMonth = month && /^\d{4}-\d{2}$/.test(month) ? month : todayIso().slice(0, 7);
  const [year, monthNumber] = selectedMonth.split('-').map(Number);
  const range = monthRange(new Date(year, monthNumber - 1, 1));
  const current = await incomeForRange(userId, range.start, range.end);
  const ytd = await incomeForRange(userId, `${year}-01-01`, range.end);
  const actualYtd = ytd.actualTotal;

  return {
    ...current,
    month: selectedMonth,
    this_month: current.total,
    ytd: actualYtd,
    average_month: actualYtd / Math.max(1, monthNumber),
    sources: new Set(current.rows.map((row) => row.source)).size,
  };
}

function nextMonthStart(month: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  const nextYear = monthNumber === 12 ? year + 1 : year;
  const nextMonth = monthNumber === 12 ? 1 : monthNumber + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
}

function lastDayOfMonth(month: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
}

/** One owner-scoped response for the mobile Income screen. */
export async function myIncomeForMonth(userId: string, month?: string) {
  const selectedMonth = month && /^\d{4}-\d{2}$/.test(month) ? month : todayIso().slice(0, 7);
  const from = `${selectedMonth}-01`;
  const nextMonth = nextMonthStart(selectedMonth);
  // The recurrence expander uses inclusive date ranges. Keep its endpoint in
  // the selected month, while posted-row filtering below remains [start, next).
  const to = lastDayOfMonth(selectedMonth);
  const summary = await incomeForRange(userId, from, to);
  const sourceRows = summary.sourceRows.filter(
    (row) => row.is_posted === false && isRecurring(row) && row.schedule_status === 'active',
  );
  const postedRows = summary.rows.filter(
    (row) =>
      !row.is_scheduled &&
      row.is_posted !== false &&
      String(row.date) >= from &&
      String(row.date) < nextMonth,
  );
  const items: MyIncomeItem[] = [];
  const today = todayIso();
  for (const row of postedRows) {
    const schedule = row.schedule_id
      ? summary.sourceRows.find((source) => String(source.id) === String(row.schedule_id))
      : undefined;
    items.push({
      kind: schedule || isRecurring(row) ? 'recurring' : 'one_time',
      sourceId: String(row.schedule_id ?? row.id),
      occurrenceId: row.schedule_id ? String(row.id) : null,
      transactionId: String(row.id),
      name: String(row.source),
      category: String(row.type ?? 'other'),
      amount: Number(row.amount ?? 0),
      frequency: schedule?.frequency
        ? String(schedule.frequency)
        : isRecurring(row)
          ? String(row.frequency ?? 'monthly')
          : null,
      status: 'received',
      dueDate: null,
      receivedDate: String(row.date),
      receivedAt: row.received_at ? String(row.received_at) : null,
      createdAt: row.created_at ? String(row.created_at) : null,
      updatedAt: row.updated_at ? String(row.updated_at) : null,
      walletId: String(row.wallet_id),
    });
  }

  for (const expected of summary.scheduledRows) {
    const scheduleId = String(expected.recurrence_key ?? '').split(':')[0];
    const source = summary.sourceRows.find((row) => String(row.id) === scheduleId);
    if (!source) continue;
    const failure = String(source.posting_status ?? source.status ?? '').toLowerCase() === 'failed';
    items.push({
      kind: isRecurring(source) ? 'recurring' : 'one_time',
      sourceId: String(source.id),
      occurrenceId: String(expected.id),
      transactionId: null,
      name: String(source.source),
      category: String(source.type ?? 'other'),
      amount: Number(source.amount ?? 0),
      frequency: source.frequency ? String(source.frequency) : null,
      status: failure ? 'failed' : String(expected.date) <= today ? 'due' : 'upcoming',
      dueDate: String(expected.date),
      receivedDate: null,
      receivedAt: null,
      createdAt: source.created_at ? String(source.created_at) : null,
      updatedAt: source.updated_at ? String(source.updated_at) : null,
      walletId: String(source.wallet_id),
    });
  }

  items.sort((left, right) => {
    const leftDate =
      left.status === 'received' ? (left.receivedDate ?? '') : (left.dueDate ?? '9999-12-31');
    const rightDate =
      right.status === 'received' ? (right.receivedDate ?? '') : (right.dueDate ?? '9999-12-31');
    const statusOrder = (status: MyIncomeItem['status']) =>
      status === 'upcoming' || status === 'due' ? 0 : 1;
    return (
      statusOrder(left.status) - statusOrder(right.status) ||
      rightDate.localeCompare(leftDate) ||
      left.sourceId.localeCompare(right.sourceId)
    );
  });

  const received = items.filter((item) => item.status === 'received');
  return {
    month: selectedMonth,
    overview: {
      receivedAmount: received.reduce((sum, item) => sum + item.amount, 0),
      receivedCount: received.length,
      upcomingCount: items.filter((item) => item.status === 'upcoming' || item.status === 'due')
        .length,
      recurringSourceCount: sourceRows.length,
      oneTimeCount: items.filter((item) => item.kind === 'one_time').length,
    },
    items,
  };
}
