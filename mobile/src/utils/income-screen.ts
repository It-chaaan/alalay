export type IncomeRequestIntent = { path: string; method: 'POST' | 'PATCH' };

export type IncomeOccurrenceKey = {
  kind?: 'recurring' | 'one_time';
  isProjected?: boolean;
  occurrenceId?: string | null;
  occurrenceKey?: string | null;
  transactionId?: string | null;
  sourceId: string;
};

export type IncomeMonthOccurrence = IncomeOccurrenceKey & {
  dueDate?: string | null;
  receivedDate?: string | null;
};

export function moveIncomeMonth(month: string, delta: number) {
  const [year, monthNumber] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function manilaIncomeMonth(value: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(value);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  if (!year || !month) throw new Error('Could not determine the Asia/Manila month.');
  return `${year}-${month}`;
}

export function canApplyIncomeResponse({
  requestId,
  currentRequestId,
  focused,
}: {
  requestId: number;
  currentRequestId: number;
  focused: boolean;
}) {
  return focused && requestId === currentRequestId;
}

export function incomeRequestIntent(id?: string): IncomeRequestIntent {
  return id ? { path: `/api/income/${id}`, method: 'PATCH' } : { path: '/api/income', method: 'POST' };
}

export function canStartIncomeSave(isSaving: boolean) {
  return !isSaving;
}

export function incomeDeleteRequestIntent(id: string) {
  return { path: `/api/income/${id}`, method: 'DELETE' as const };
}

export function occurrenceBelongsToIncomeMonth(
  occurrence: IncomeMonthOccurrence,
  selectedMonth: string,
) {
  const date = occurrence.receivedDate ?? occurrence.dueDate;
  return date?.slice(0, 7) === selectedMonth;
}

export function shouldRefreshIncomeForMutation(focused: boolean) {
  return focused;
}

export function presentationIncomeOccurrences<T extends IncomeOccurrenceKey>(occurrences: T[]) {
  const seen = new Set<string>();
  let duplicateProjectedOccurrences = 0;
  const items = occurrences.filter((occurrence) => {
    // Posted/manual rows represent financial effects. Never suppress them in the
    // client: wallet and transaction integrity remains observable and backend-authoritative.
    if (occurrence.kind !== 'recurring' || !occurrence.isProjected) return true;
    const key = occurrence.occurrenceKey ?? occurrence.sourceId;
    if (seen.has(key)) {
      duplicateProjectedOccurrences += 1;
      return false;
    }
    seen.add(key);
    return true;
  });
  return { items, duplicateProjectedOccurrences };
}
